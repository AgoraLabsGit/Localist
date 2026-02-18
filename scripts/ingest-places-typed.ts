/**
 * EXPERIMENTAL: Type-based discovery + grid tiling + PostGIS neighborhoods
 *
 * Includes venue deduplication (canonical_key) and grid 5×5 for BA (migration 027).
 *
 * Google Places (includedType + tiled search) + Foursquare (details) → Supabase
 * Replaces two-lane logic with single rating gate. Uses PostGIS for neighborhood lookup when polygons exist.
 *
 * Requires migrations 019–023 (PostGIS, city_neighborhoods.geom, cities tiling/gates, city_categories discovery, venue place types).
 *
 * Usage:
 *   npx tsx scripts/ingest-places-typed.ts [city-slug]
 *   npx tsx scripts/ingest-places-typed.ts --list
 *
 * Production (live cities): use --force --incremental to ensure discovery runs and FSQ costs stay low:
 *   npm run ingest:places:typed -- <city-slug> --force --incremental
 *
 * See docs/DATA-PIPELINE.md for full spec.
 */

import { createHash } from "crypto";
import { config } from "dotenv";
config({ path: ".env.local" });
import geohash from "ngeohash";
import { createClient } from "@supabase/supabase-js";
import { getCityConfig, listCitySlugs, type CityConfig } from "./config/cities";
import { loadCityFromDb, listCitySlugsFromDb, getDefaultCitySlug, type CityConfigFromDb } from "./lib/load-city-from-db";
import { loadPipelineSettings, resolveMaxFoursquareCalls } from "../src/lib/admin-settings";
import {
  deriveVenueCaps,
  deriveBaseGatesForCity,
  adjustGatesForThinCategory,
  isThinCategory,
} from "../src/lib/venue-caps";
import { GOOGLE_DISCOVERY_PROFILES } from "./config/google-discovery-profiles";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Single rating gate defaults when not in config */
const DEFAULT_MIN_RATING_GATE = 4.3;
const DEFAULT_MIN_REVIEWS_GATE = 5;
const DEFAULT_GRID_ROWS = 3;
const DEFAULT_GRID_COLS = 3;

interface AddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address?: string;
  address_components?: AddressComponent[];
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  vicinity?: string;
  /** From Google types/primaryType; persisted to venues.google_types */
  types?: string[];
}

/** Single tip for fsq_tips JSONB storage */
export interface FoursquareTip {
  text: string;
  created_at?: string;
  lang?: string;
  likes?: number;
}

interface FoursquareData {
  foursquare_id: string;
  address: string | null;
  opening_hours: string[] | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  rating_count: number | null;
  price: number | null;
  neighborhood: string | null;
  photo_urls: string[];
  description: string | null;
  /** Raw FSQ categories; persisted to venues.fsq_categories */
  categories?: Array<{ id?: string; name?: string; primary?: boolean }>;
  /** Top tips; input for AI enrichment only; not exposed as raw corpus */
  tips?: FoursquareTip[];
}

/** Extended category from DB (migration 022, 036) */
interface CategoryWithDiscovery {
  query: string;
  category: string;
  minRating: number;
  dbId: string;
  maxCount?: number;
  googleIncludedType?: string | null;
  textQueryKeywords?: string | null;
  minRatingGate?: number | null;
  minReviewsGate?: number | null;
  perTileMax?: number | null;
  minResultsPerTile?: number | null;
}

/** Extended city from DB (migration 021, 036) */
interface CityWithTiling {
  center: { lat: number; lng: number };
  radiusMeters: number;
  name: string;
  dbId?: string;
  cityFallbackName?: string;
  neighborhoods: string[];
  gridRows?: number | null;
  gridCols?: number | null;
  minRatingGate?: number | null;
  minReviewsGate?: number | null;
  population?: number | null;
}

function mapPlaceToGooglePlace(p: {
  id: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  formattedAddress?: string;
  addressComponents?: AddressComponent[];
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  primaryType?: string;
}): GooglePlace {
  const types: string[] = [];
  if (p.primaryType) types.push(p.primaryType);
  if (Array.isArray(p.types)) types.push(...p.types.filter((t) => t && !types.includes(t)));
  return {
    place_id: p.id,
    name: p.displayName?.text ?? "",
    formatted_address: p.formattedAddress,
    address_components: p.addressComponents,
    geometry: {
      location: {
        lat: p.location?.latitude ?? 0,
        lng: p.location?.longitude ?? 0,
      },
    },
    rating: p.rating,
    user_ratings_total: p.userRatingCount,
    types: types.length > 0 ? types : undefined,
  };
}

/** Tile with row/col for tileId. Grid spans city diameter (2× radius). */
interface TileWithIndex {
  lat: number;
  lng: number;
  radiusMeters: number;
  rowIndex: number;
  colIndex: number;
}

function generateTileCenters(city: CityWithTiling): TileWithIndex[] {
  const rows = city.gridRows ?? DEFAULT_GRID_ROWS;
  const cols = city.gridCols ?? DEFAULT_GRID_COLS;
  const tileRadius = Math.ceil(city.radiusMeters / Math.max(rows, cols));

  const radiusDegLat = city.radiusMeters / 111320;
  const radiusDegLng = city.radiusMeters / (111320 * Math.cos((city.center.lat * Math.PI) / 180));

  const latStep = rows > 1 ? (2 * radiusDegLat) / (rows - 1) : 0;
  const lngStep = cols > 1 ? (2 * radiusDegLng) / (cols - 1) : 0;

  const startLat = city.center.lat - radiusDegLat;
  const startLng = city.center.lng - radiusDegLng;

  const tiles: TileWithIndex[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push({
        lat: startLat + r * latStep,
        lng: startLng + c * lngStep,
        radiusMeters: tileRadius,
        rowIndex: r,
        colIndex: c,
      });
    }
  }
  return tiles;
}

/** Single rating gate: rating >= gate AND user_ratings_total >= gate */
function passesRatingGate(
  place: GooglePlace,
  minRating: number,
  minReviews: number
): boolean {
  const r = place.rating ?? 0;
  const n = place.user_ratings_total ?? 0;
  return r >= minRating && n >= minReviews;
}

function resolveRatingGates(
  category: CategoryWithDiscovery,
  city: CityWithTiling
): { minRating: number; minReviews: number } {
  let base: { minRating: number; minReviews: number };
  if (category.minRatingGate != null && category.minReviewsGate != null) {
    base = { minRating: category.minRatingGate, minReviews: category.minReviewsGate };
  } else if (
    (city as { minRatingGate?: number }).minRatingGate != null &&
    (city as { minReviewsGate?: number }).minReviewsGate != null
  ) {
    base = {
      minRating: (city as { minRatingGate: number }).minRatingGate,
      minReviews: (city as { minReviewsGate: number }).minReviewsGate,
    };
  } else {
    base = deriveBaseGatesForCity((city as { population?: number | null }).population ?? null);
    if (isThinCategory(category.category)) base = adjustGatesForThinCategory(base);
  }
  return base;
}

/** Multiple query patterns per tile for better coverage without lowering gates. */
function getDiscoveryPatterns(category: CategoryWithDiscovery): Array<{ includedType?: string; textQuery: string }> {
  // Cafe: use frozen minimal profile (best main_gate_count in outer tiles per test-google-discovery)
  if (category.category === "cafe") {
    return GOOGLE_DISCOVERY_PROFILES.cafe.patterns;
  }

  const baseQuery = category.textQueryKeywords
    ? category.textQueryKeywords
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" ") || category.query
    : category.query;

  const patterns: Array<{ includedType?: string; textQuery: string }> = [
    { includedType: category.googleIncludedType ?? undefined, textQuery: baseQuery },
  ];

  // Brunch: restaurant + "brunch" already primary; add "café" for crossover spots
  if (category.category === "brunch") {
    patterns.push({ includedType: "restaurant", textQuery: "café brunch" });
  }

  return patterns;
}

/** Resolve maxCount and perTileMax: DB overrides or derive from city. */
function resolveCaps(
  category: CategoryWithDiscovery,
  city: CityWithTiling
): { maxCount: number; perTileMax: number; minResultsPerTile: number } {
  const derived = deriveVenueCaps({
    population: (city as { population?: number | null }).population ?? null,
    radiusMeters: city.radiusMeters,
    gridRows: city.gridRows,
    gridCols: city.gridCols,
  });
  return {
    maxCount: category.maxCount ?? derived.maxCount,
    perTileMax: category.perTileMax ?? derived.perTileMax,
    minResultsPerTile: category.minResultsPerTile ?? 8,
  };
}

const FIELD_MASK =
  "places.id,places.displayName,places.location,places.formattedAddress,places.addressComponents,places.rating,places.userRatingCount,places.types,places.primaryType,nextPageToken";

/** Fetch one query pattern for a tile; walks full pagination (up to maxPages). */
async function fetchTileWithPattern(
  pattern: { includedType?: string; textQuery: string },
  tile: TileWithIndex,
  rows: number,
  cols: number,
  maxPages: number
): Promise<GooglePlace[]> {
  const isOuterTile =
    tile.rowIndex === 0 ||
    tile.rowIndex === rows - 1 ||
    tile.colIndex === 0 ||
    tile.colIndex === cols - 1;
  const radiusMeters = isOuterTile ? Math.ceil(tile.radiusMeters * 1.3) : tile.radiusMeters;

  const raw: GooglePlace[] = [];
  let pageToken: string | undefined;
  let pageCount = 0;

  do {
    const body: Record<string, unknown> = {
      textQuery: pattern.textQuery || " ",
      locationBias: {
        circle: {
          center: { latitude: tile.lat, longitude: tile.lng },
          radius: radiusMeters,
        },
      },
      maxResultCount: 20,
    };
    if (pattern.includedType) {
      body.includedType = pattern.includedType;
      body.strictTypeFiltering = true;
    }
    if (pageToken) body.pageToken = pageToken;

    googleCallsMade++;
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.error) return raw;

    const pagePlaces = (data.places ?? []).map((p: Record<string, unknown>) =>
      mapPlaceToGooglePlace(p as Parameters<typeof mapPlaceToGooglePlace>[0])
    );
    raw.push(...pagePlaces);
    pageToken = data.nextPageToken ?? undefined;
    pageCount++;
  } while (pageToken && pageCount < maxPages);

  return raw;
}

/** Result of searchGooglePlacesTyped: places + per-tile counts for logging. */
interface SearchResult {
  places: GooglePlace[];
  tileCounts: Record<string, number>;
}

/**
 * Google Text Search: multi-query discovery, per-tile caps, sparse-tile relaxation as last resort.
 * Order: (1) multiple query patterns + full pagination, (2) apply rating gates, (3) only if still
 * below min_results_per_tile, relax gates for previously rejected candidates.
 */
async function searchGooglePlacesTyped(
  category: CategoryWithDiscovery,
  city: CityWithTiling
): Promise<SearchResult> {
  const { minRating, minReviews } = resolveRatingGates(category, city);
  const { maxCount, perTileMax, minResultsPerTile } = resolveCaps(category, city);
  const patterns = getDiscoveryPatterns(category);

  const rows = city.gridRows ?? DEFAULT_GRID_ROWS;
  const cols = city.gridCols ?? DEFAULT_GRID_COLS;
  // Cafe/brunch: more pages to surface specialty cafés that rank lower in generic queries
  const isCafeLike = category.category === "cafe" || category.category === "brunch";
  const maxPagesInner = isCafeLike ? 8 : 6;
  const maxPagesOuter = isCafeLike ? 10 : 8;

  const tiles = generateTileCenters(city);
  const seen = new Set<string>();
  const all: GooglePlace[] = [];
  const tileCounts: Record<string, number> = {};
  let totalForCategory = 0;

  /** Reserve floor(maxCount/tiles) per tile so late tiles (e.g. north) aren't starved. */
  const minPerTile = Math.floor(maxCount / tiles.length);

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const tileId = `${tile.rowIndex}-${tile.colIndex}`;
    const tilesLeft = tiles.length - i - 1;
    const reservedForRemaining = tilesLeft * minPerTile;
    const maxFromThisTile = Math.min(
      perTileMax,
      Math.max(0, maxCount - totalForCategory - reservedForRemaining)
    );
    if (maxFromThisTile <= 0) continue;

    const currentTileCount = tileCounts[tileId] ?? 0;
    if (currentTileCount >= maxFromThisTile) continue;

    const isOuter =
      tile.rowIndex === 0 ||
      tile.rowIndex === rows - 1 ||
      tile.colIndex === 0 ||
      tile.colIndex === cols - 1;
    const maxPages = isOuter ? maxPagesOuter : maxPagesInner;

    const rawByPlaceId = new Map<string, GooglePlace>();
    for (const pattern of patterns) {
      const chunk = await fetchTileWithPattern(pattern, tile, rows, cols, maxPages);
      for (const p of chunk) rawByPlaceId.set(p.place_id, p);
      await new Promise((r) => setTimeout(r, 200));
    }
    const raw = Array.from(rawByPlaceId.values());

    let tileCandidates: GooglePlace[] = raw.filter(
      (p) => !seen.has(p.place_id) && passesRatingGate(p, minRating, minReviews)
    );

    if (tileCandidates.length < minResultsPerTile) {
      const relaxedRating = Math.max(3.6, minRating - 0.3);
      const relaxedReviews = Math.max(1, minReviews - 2);
      const acceptedMainIds = new Set(tileCandidates.map((p) => p.place_id));
      const acceptedRelaxed = raw.filter(
        (p) =>
          !acceptedMainIds.has(p.place_id) &&
          !seen.has(p.place_id) &&
          passesRatingGate(p, relaxedRating, relaxedReviews)
      );
      tileCandidates = [...tileCandidates, ...acceptedRelaxed];
    }

    for (const p of tileCandidates) {
      if (totalForCategory >= maxCount) break;
      if ((tileCounts[tileId] ?? 0) >= maxFromThisTile) break;
      if (seen.has(p.place_id)) continue;
      seen.add(p.place_id);
      all.push(p);
      tileCounts[tileId] = (tileCounts[tileId] ?? 0) + 1;
      totalForCategory++;
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  return { places: all, tileCounts };
}

/** Neighborhood-specific query: "best cafe Villa Urquiza" surfaces local results city-wide tiles miss. */
async function searchGooglePlacesNeighborhood(
  query: string,
  category: CategoryWithDiscovery,
  city: CityWithTiling,
  seenPlaceIds: Set<string>,
  maxCount: number
): Promise<GooglePlace[]> {
  const { minRating, minReviews } = resolveRatingGates(category, city);
  const raw: GooglePlace[] = [];
  let pageToken: string | undefined;
  const maxPages = 5;

  for (let page = 0; page < maxPages; page++) {
    const body: Record<string, unknown> = {
      textQuery: query || " ",
      locationBias: {
        circle: {
          center: { latitude: city.center.lat, longitude: city.center.lng },
          radius: city.radiusMeters,
        },
      },
      maxResultCount: 20,
    };
    if (pageToken) body.pageToken = pageToken;

    googleCallsMade++;
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) break;
    const pagePlaces = (data.places ?? []).map((p: Record<string, unknown>) =>
      mapPlaceToGooglePlace(p as Parameters<typeof mapPlaceToGooglePlace>[0])
    );
    raw.push(...pagePlaces);
    pageToken = data.nextPageToken ?? undefined;
    if (!pageToken || pagePlaces.length === 0) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  const passed = raw.filter(
    (p) => !seenPlaceIds.has(p.place_id) && passesRatingGate(p, minRating, minReviews)
  );
  return passed.slice(0, maxCount);
}

const FSQ_BASE = "https://places-api.foursquare.com";
const FSQ_HEADERS = {
  Authorization: `Bearer ${FOURSQUARE_API_KEY}`,
  Accept: "application/json",
  "X-Places-Api-Version": "2025-06-17",
};

let fsqRateLimited = false;
let MAX_FSQ_CALLS: number | undefined;
let fsqCallsMade = 0;
let googleCallsMade = 0;

function checkFsqLimit(): boolean {
  if (fsqRateLimited) return true;
  if (MAX_FSQ_CALLS != null && fsqCallsMade >= MAX_FSQ_CALLS) {
    fsqRateLimited = true;
    console.warn(`   ⚠️ Foursquare: reached limit (${MAX_FSQ_CALLS}). Skipping enrichment.`);
    return true;
  }
  return false;
}

async function searchFoursquarePlace(name: string, lat: number, lng: number): Promise<string | null> {
  if (checkFsqLimit()) return null;

  const url = new URL(`${FSQ_BASE}/places/search`);
  url.searchParams.set("ll", `${lat},${lng}`);
  url.searchParams.set("query", name);
  url.searchParams.set("limit", "5");
  url.searchParams.set("radius", "15000");

  fsqCallsMade++;
  const res = await fetch(url.toString(), { headers: FSQ_HEADERS });

  if (!res.ok) {
    if (res.status === 429) fsqRateLimited = true;
    if (res.status === 401) fsqRateLimited = true;
    return null;
  }
  const data = await res.json();
  const results = data.results ?? [];
  if (results.length === 0) return null;

  const nameLower = name.toLowerCase();
  const significantTokens = (s: string) =>
    s
      .toLowerCase()
      .replace(/['"]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !/^(la|el|los|las|de|del|y|&|the|and|of)$/.test(w));

  const queryTokens = new Set(significantTokens(name));
  const match = results.find((r: { name?: string }) => {
    if (!r.name) return false;
    const rn = r.name.toLowerCase();
    // Substring match (existing logic)
    if (rn.includes(nameLower) || nameLower.includes(rn)) return true;
    // Token overlap: at least 1 significant word in common (catches "La Baldosa" vs "La Baldosa Milonga")
    const rt = significantTokens(r.name);
    if (rt.some((t) => queryTokens.has(t))) return true;
    return false;
  });
  // Never fallback to results[0] when no match — avoids wrong venue (e.g. fish store for La Baldosa Milonga)
  if (!match) return null;
  return match.fsq_place_id ?? match.fsq_id ?? null;
}

/** Max tips to store per venue; small representative sample for AI enrichment */
const MAX_TIPS_PER_VENUE = 8;

/** Skip re-fetching tips if last fetch within this many days */
const TIPS_FRESHNESS_DAYS = 90;

function isTipsFresh(fetchedAt: string | null | undefined): boolean {
  if (!fetchedAt) return false;
  const d = new Date(fetchedAt);
  if (Number.isNaN(d.getTime())) return false;
  const daysSince = (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000);
  return daysSince < TIPS_FRESHNESS_DAYS;
}

/** Fetch top tips for a place. Counts toward MAX_FSQ_CALLS. */
async function getFoursquareTips(fsqId: string): Promise<FoursquareTip[]> {
  if (checkFsqLimit()) return [];
  fsqCallsMade++;
  const url = new URL(`${FSQ_BASE}/places/${fsqId}/tips`);
  url.searchParams.set("limit", String(MAX_TIPS_PER_VENUE));
  url.searchParams.set("sort", "POPULAR");
  url.searchParams.set("fields", "text,created_at,lang,agree_count");

  const res = await fetch(url.toString(), { headers: FSQ_HEADERS });
  if (!res.ok) return [];
  const data = await res.json();
  const items = Array.isArray(data) ? data : data?.results ?? [];
  return items
    .filter((t: { text?: string }) => typeof t?.text === "string" && t.text.trim().length > 0)
    .map((t: { text: string; created_at?: string; lang?: string; agree_count?: number }) => ({
      text: (t.text ?? "").trim(),
      created_at: t.created_at ?? undefined,
      lang: t.lang ?? undefined,
      likes: typeof t.agree_count === "number" ? t.agree_count : undefined,
    }));
}

/** Foursquare Place Details — includes categories for fsq_categories. */
async function getFoursquareDetails(fsqId: string, city: CityConfig): Promise<FoursquareData | null> {
  if (checkFsqLimit()) return null;
  fsqCallsMade++;
  const url = new URL(`${FSQ_BASE}/places/${fsqId}`);
  url.searchParams.set(
    "fields",
    "location,hours,tel,website,rating,stats,price,description,categories"
  );

  const res = await fetch(url.toString(), { headers: FSQ_HEADERS });
  if (!res.ok) return null;
  const p = await res.json();

  const loc = p.location ?? {};
  const address =
    loc.formatted_address ??
    ([loc.address, loc.locality, loc.region].filter(Boolean).join(", ") || null);

  const locNeighborhood = loc.neighborhood;
  const fsqNeighborhood =
    Array.isArray(locNeighborhood) && locNeighborhood.length > 0
      ? locNeighborhood[0]
      : typeof locNeighborhood === "string"
        ? locNeighborhood
        : null;

  let opening_hours: string[] | null = null;
  const hours = p.hours ?? {};
  if (hours.display) {
    opening_hours = typeof hours.display === "string" ? [hours.display] : hours.display;
  } else if (Array.isArray(hours.regular)) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    opening_hours = hours.regular.map((r: { day?: number; open?: string; close?: string }) => {
      const d = r.day ?? 1;
      const dayLabel = d === 7 ? days[0] : days[d >= 1 && d <= 6 ? d : 1];
      return `${dayLabel}: ${r.open ?? "?"}-${r.close ?? "?"}`;
    });
  }

  const stats = p.stats ?? {};
  const rating_count = typeof stats.total_ratings === "number" ? stats.total_ratings : null;
  const price = typeof p.price === "number" && p.price >= 1 && p.price <= 4 ? p.price : null;
  const description = typeof p.description === "string" && p.description.trim() ? p.description.trim() : null;
  const categories = Array.isArray(p.categories)
    ? p.categories.map((c: { id?: string; name?: string; primary?: boolean }) => ({
        id: c.id,
        name: c.name,
        primary: c.primary,
      }))
    : undefined;

  return {
    foursquare_id: fsqId,
    address,
    opening_hours,
    phone: p.tel ?? null,
    website: p.website ?? null,
    rating: p.rating ?? null,
    rating_count,
    price,
    neighborhood: fsqNeighborhood ? guessNeighborhoodFromName(fsqNeighborhood, city) : null,
    photo_urls: [],
    description,
    categories,
  };
}

function isCityLevelAlias(name: string, city: CityConfig & { addressAliases?: string[] }): boolean {
  const cityName = city.cityFallbackName ?? city.name;
  return name === cityName || (city.addressAliases ?? []).some((a) => a.toLowerCase() === name.toLowerCase());
}

function guessNeighborhoodFromName(name: string, city: CityConfig): string | null {
  const n = name.trim();
  if (!n || isCityLevelAlias(n, city)) return null;
  const match = city.neighborhoods.find(
    (known) => n.toLowerCase() === known.toLowerCase() || n.toLowerCase().startsWith(known.toLowerCase() + " ")
  );
  return match ?? n;
}

function guessNeighborhood(address: string, city: CityConfig): string {
  const cityName = city.cityFallbackName ?? city.name;
  for (const n of city.neighborhoods) {
    if (address.toLowerCase().includes(n.toLowerCase())) return n;
  }
  return cityName;
}

function extractNeighborhoodFromAddressComponents(
  components: AddressComponent[] | undefined,
  city: CityConfig
): string | null {
  if (!Array.isArray(components) || components.length === 0) return null;
  const cityName = city.cityFallbackName ?? city.name;
  const neighborhoodTypes = ["neighborhood", "sublocality", "sublocality_level_1", "administrative_area_level_2"];
  for (const comp of components) {
    const types = comp.types ?? [];
    const hasNeighborhood = types.some((t: string) => neighborhoodTypes.includes(t));
    const name = (comp.longText ?? comp.shortText ?? "").trim();
    if (hasNeighborhood && name) {
      const match = city.neighborhoods.find(
        (n) =>
          name.toLowerCase() === n.toLowerCase() || name.toLowerCase().startsWith(n.toLowerCase() + " ")
      );
      if (match) return match;
      if (name && !isCityLevelAlias(name, city)) return name;
    }
  }
  return null;
}

async function resolveNeighborhoodFromCoords(
  lat: number,
  lng: number,
  fallbackAddress: string,
  city: CityConfig
): Promise<string> {
  const cityName = city.cityFallbackName ?? city.name;
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return guessNeighborhood(fallbackAddress, city);
  }
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", GOOGLE_API_KEY);
  url.searchParams.set("language", city.geocodeLanguage ?? "en");

  googleCallsMade++;
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.status !== "OK" || !Array.isArray(data.results)) {
    return guessNeighborhood(fallbackAddress, city);
  }
  const neighborhoodTypes = ["neighborhood", "sublocality", "sublocality_level_1", "administrative_area_level_2"];
  for (const result of data.results) {
    for (const comp of result.address_components ?? []) {
      const types = comp.types ?? [];
      const hasNeighborhood = types.some((t: string) => neighborhoodTypes.includes(t));
      if (hasNeighborhood && comp.long_name) {
        const name = comp.long_name.trim();
        const match = city.neighborhoods.find(
          (n) => name.toLowerCase() === n.toLowerCase() || name.toLowerCase().startsWith(n.toLowerCase() + " ")
        );
        if (match) return match;
        if (name && !isCityLevelAlias(name, city)) return name;
      }
    }
  }
  return guessNeighborhood(fallbackAddress, city);
}

/** PostGIS point-in-polygon lookup. Falls back to null when geom not populated or RPC missing. */
async function lookupNeighborhoodByGeom(
  cityId: string,
  lat: number,
  lng: number
): Promise<string | null> {
  const { data, error } = await supabase.rpc("lookup_neighborhood", {
    city_id: cityId,
    lng,
    lat,
  });
  if (error) return null;
  return typeof data === "string" && data.trim() ? data.trim() : null;
}

async function resolveNeighborhood(
  place: GooglePlace,
  city: CityConfigFromDb,
  fsq: FoursquareData | null
): Promise<string> {
  const cityName = city.cityFallbackName ?? city.name;
  const { lat, lng } = place.geometry.location;

  // 1. PostGIS (when polygons exist)
  if (city.dbId) {
    const geom = await lookupNeighborhoodByGeom(city.dbId, lat, lng);
    if (geom) return geom;
  }

  // 2. Google address components
  const fromAddr = extractNeighborhoodFromAddressComponents(place.address_components, city);
  if (fromAddr) return fromAddr;

  // 3. Reverse geocode
  const fromGeocode = await resolveNeighborhoodFromCoords(
    lat,
    lng,
    place.formatted_address ?? place.vicinity ?? "",
    city
  );
  if (fromGeocode !== cityName) return fromGeocode;

  // 4. FSQ neighborhood
  if (fsq?.neighborhood) return fsq.neighborhood;

  // 5. Parse from address
  const fromGoogle = guessNeighborhood(place.formatted_address ?? "", city);
  if (fromGoogle !== cityName) return fromGoogle;
  if (fsq?.address) {
    const fromFsq = guessNeighborhood(fsq.address, city);
    if (fromFsq !== cityName) return fromFsq;
  }
  return cityName;
}

function fsqPriceToUsd(price: number | null): number | null {
  if (price == null || price < 1 || price > 4) return null;
  const map: Record<number, number> = { 1: 10, 2: 25, 3: 50, 4: 100 };
  return map[price] ?? null;
}

/** Normalize address: lowercase, trim, collapse spaces, strip trailing city-like suffix */
function normalizeAddress(addr: string): string {
  let s = addr
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  // Strip trailing ", city" or ", country" (simple heuristic: last comma segment)
  const lastComma = s.lastIndexOf(",");
  if (lastComma > 0) {
    const suffix = s.slice(lastComma + 1).trim();
    if (suffix.length <= 30) s = s.slice(0, lastComma).trim();
  }
  return s;
}

/** Normalize name: lowercase, trim, collapse spaces */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Compute canonical dedup key per docs/DATA-QUALITY-AND-PERFORMANCE.md §2 */
function computeCanonicalKey(
  place: GooglePlace,
  fsq: FoursquareData | null
): string {
  const addr = fsq?.address ?? place.formatted_address ?? place.vicinity ?? "";
  const lat = place.geometry.location.lat;
  const lng = place.geometry.location.lng;

  if (addr && addr.trim().length > 0) {
    return createHash("sha256").update(normalizeAddress(addr)).digest("hex");
  }
  if (lat != null && lng != null) {
    const gh = geohash.encode(lat, lng, 7);
    return createHash("sha256")
      .update(normalizeName(place.name) + gh)
      .digest("hex");
  }
  return place.place_id; // fallback: no dedup
}

/** For incremental mode: fetch existing venue to skip redundant FSQ calls. */
async function getExistingVenue(
  googlePlaceId: string
): Promise<{ id: string; neighborhood: string | null; foursquare_id: string | null; website_url: string | null } | null> {
  const { data } = await supabase
    .from("venues")
    .select("id, neighborhood, foursquare_id, website_url")
    .eq("google_place_id", googlePlaceId)
    .maybeSingle();
  return data;
}

/** Batch-fetch existing venues by google_place_id (reduces Supabase calls in incremental mode). */
async function batchGetExistingVenues(
  placeIds: string[],
  city: CityConfigFromDb
): Promise<Map<string, { id: string; neighborhood: string | null; foursquare_id: string | null; website_url: string | null }>> {
  const map = new Map<string, { id: string; neighborhood: string | null; foursquare_id: string | null; website_url: string | null }>();
  const CHUNK = 200;
  for (let i = 0; i < placeIds.length; i += CHUNK) {
    const chunk = placeIds.slice(i, i + CHUNK);
    let q = supabase.from("venues").select("google_place_id, id, neighborhood, foursquare_id, website_url").in("google_place_id", chunk);
    if (city.dbId) q = q.eq("city_id", city.dbId);
    else q = q.eq("city", city.cityFallbackName ?? city.name);
    const { data } = await q;
    for (const row of data ?? []) {
      if (row.google_place_id) map.set(row.google_place_id, { id: row.id, neighborhood: row.neighborhood, foursquare_id: row.foursquare_id, website_url: row.website_url });
    }
  }
  return map;
}

/** Find existing venue with same canonical_key in same city (merge-before-insert) */
async function findVenueByCanonicalKey(
  canonicalKey: string,
  city: CityConfigFromDb
): Promise<{ id: string; fsq_tips_fetched_at: string | null } | null> {
  if (canonicalKey === "") return null;
  const cityName = city.cityFallbackName ?? city.name;
  let q = supabase
    .from("venues")
    .select("id, fsq_tips_fetched_at")
    .eq("canonical_key", canonicalKey)
    .limit(1);
  if (city.dbId) q = q.eq("city_id", city.dbId);
  else q = q.eq("city", cityName);
  const { data } = await q.maybeSingle();
  if (!data?.id) return null;
  return {
    id: data.id,
    fsq_tips_fetched_at: (data.fsq_tips_fetched_at as string | null) ?? null,
  };
}

async function upsertVenue(
  place: GooglePlace,
  neighborhood: string,
  fsq: FoursquareData | null,
  city: CityConfigFromDb,
  canonicalKey: string
) {

  const payload: Record<string, unknown> = {
    google_place_id: place.place_id,
    name: place.name,
    canonical_key: canonicalKey,
    city: city.name,
    neighborhood,
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
    has_fsq_data: fsq != null,
    is_hidden_gem: false, // No two-lane; set by compute-quality-scores later
    google_types: place.types ?? null,
    fsq_categories: fsq?.categories ?? null,
    updated_at: new Date().toISOString(),
  };
  if (city.dbId) payload.city_id = city.dbId;

  if (fsq) {
    payload.foursquare_id = fsq.foursquare_id;
    payload.address = fsq.address;
    payload.opening_hours = fsq.opening_hours;
    payload.phone = fsq.phone;
    payload.website_url = fsq.website;
    payload.rating = fsq.rating;
    payload.rating_count = fsq.rating_count;
    payload.photo_urls = fsq.photo_urls ?? [];
    if (fsq.tips != null && fsq.tips.length > 0) {
      payload.fsq_tips = fsq.tips;
      payload.fsq_tips_fetched_at = new Date().toISOString();
    }
  } else {
    payload.foursquare_id = null;
    payload.address = null;
    payload.opening_hours = null;
    payload.phone = null;
    payload.website_url = null;
    // Default 9 when no FSQ: venues passed ingest gate (4.5+ Google stars); 4.5 × 2 ≈ 9 on FSQ 0–10 scale
    payload.rating = 9;
    payload.rating_count = null;
    payload.photo_urls = [];
  }

  const { data, error } = await supabase
    .from("venues")
    .upsert(payload, { onConflict: "google_place_id" })
    .select("id")
    .single();

  if (error) {
    console.error(`  Venue upsert failed for ${place.name}:`, error.message);
    return null;
  }
  return data.id;
}

async function upsertHighlight(
  venueId: string,
  place: GooglePlace,
  category: string,
  neighborhood: string,
  website: string | null,
  price: number | null,
  city: CityConfigFromDb,
  fsqDescription?: string | null
) {
  const description = fsqDescription && fsqDescription.trim() ? fsqDescription.trim() : null;
  const payload: Record<string, unknown> = {
    title: place.name,
    short_description: description,
    category,
    venue_id: venueId,
    city: city.name,
    neighborhood,
    status: "active",
    url: website,
    avg_expected_price: price,
    updated_at: new Date().toISOString(),
  };
  if (city.dbId) payload.city_id = city.dbId;
  if (city.categoryIdBySlug?.[category]) payload.city_category_id = city.categoryIdBySlug[category];

  const { error } = await supabase.from("highlights").upsert(payload, {
    onConflict: "venue_id,category",
  });
  if (error) console.error(`  Highlight upsert failed for ${place.name}:`, error.message);
}

async function main() {
  const args = process.argv.filter((a) => !a.startsWith("--"));
  const citySlug = args[2] ?? (await getDefaultCitySlug(supabase));
  const INCREMENTAL = process.argv.includes("--incremental");
  const FORCE = process.argv.includes("--force");
  const LIST_CITIES = process.argv.includes("--list");
  const categoryArg = process.argv.find((a) => a.startsWith("--category="));
  const CATEGORY_FILTER = categoryArg ? categoryArg.split("=")[1]?.split(",").map((s) => s.trim()).filter(Boolean) : null;

  if (LIST_CITIES) {
    console.log("\n📋 Available cities:\n");
    const slugs = await listCitySlugsFromDb(supabase);
    if (slugs.length > 0) {
      for (const slug of slugs) {
        const cityRow = await loadCityFromDb(supabase, slug);
        console.log(`   ${slug} — ${cityRow?.name ?? slug}`);
      }
    } else {
      for (const slug of listCitySlugs()) {
        const c = getCityConfig(slug);
        if (c) console.log(`   ${slug} — ${c.name} (config)`);
      }
    }
    console.log("\nUsage: npx tsx scripts/ingest-places-typed.ts <city-slug> [--incremental] [--force] [--category=cafe]");
    console.log("Production (live cities): npm run ingest:places:typed -- <city-slug> --force --incremental");
    console.log("Cafe-only test: npm run ingest:places:typed -- buenos-aires --force --incremental --category=cafe\n");
    return;
  }

  let city: CityConfigFromDb | null = await loadCityFromDb(supabase, citySlug);
  if (!city) city = getCityConfig(citySlug) as unknown as CityConfigFromDb;
  if (!city) {
    console.error(`❌ Unknown city: "${citySlug}". Use --list. Run seed: npx tsx scripts/seed-cities.ts`);
    process.exit(1);
  }

  if (!GOOGLE_API_KEY) {
    console.error("❌ GOOGLE_PLACES_API_KEY is required.");
    process.exit(1);
  }
  if (!FOURSQUARE_API_KEY) {
    console.error("❌ FOURSQUARE_API_KEY is required.");
    process.exit(1);
  }

  try {
    const settings = await loadPipelineSettings(supabase);
    MAX_FSQ_CALLS = resolveMaxFoursquareCalls(settings, process.env.MAX_FOURSQUARE_CALLS ? parseInt(process.env.MAX_FOURSQUARE_CALLS, 10) : undefined);
  } catch {
    MAX_FSQ_CALLS = process.env.MAX_FOURSQUARE_CALLS ? parseInt(process.env.MAX_FOURSQUARE_CALLS, 10) : undefined;
  }

  const startedAt = new Date();
  const cityName = city.cityFallbackName ?? city.name;
  console.log(`\n🌆 Ingesting (typed/tiled): ${city.name}\n`);
  console.log(
    INCREMENTAL
      ? "🔍 Mode: incremental — skipping Foursquare for venues that already have data.\n"
      : "🔍 Mode: full — Foursquare enrichment for every place.\n"
  );
  if (FORCE) console.log("   ⚡ --force: bypassing max_total_per_city cap\n");
  if (MAX_FSQ_CALLS != null) console.log(`   Foursquare cap: ${MAX_FSQ_CALLS}\n`);

  let totalFetched = 0;
  let totalSaved = 0;
  let totalSkipped = 0;
  const perCategoryCounts = new Map<string, number>();
  const neighborhoodCounts = new Map<string, number>();
  const maxTotalPerCity = city.maxTotalPerCity;

  let categories = city.categories as unknown as CategoryWithDiscovery[];
  if (CATEGORY_FILTER && CATEGORY_FILTER.length > 0) {
    categories = categories.filter((c) => CATEGORY_FILTER.includes(c.category));
    console.log(`   🎯 Category filter: ${CATEGORY_FILTER.join(", ")} only\n`);
  }
  const cityWithTiling = city as unknown as CityWithTiling;

  for (const cat of categories) {
    if (!FORCE && maxTotalPerCity != null) {
      let countQuery = supabase.from("venues").select("id", { count: "exact", head: true });
      if (city.dbId) countQuery = countQuery.eq("city_id", city.dbId);
      else countQuery = countQuery.eq("city", city.name);
      const { count } = await countQuery;
      if ((count ?? 0) >= maxTotalPerCity) {
        console.log(`   ⏹️ Reached max_total_per_city (${maxTotalPerCity}); stopping.`);
        break;
      }
    }

    const profileNote = cat.category === "cafe" ? " [minimal profile]" : "";
    console.log(`📂 ${cat.category}: ${cat.googleIncludedType ? `type=${cat.googleIncludedType}` : "text"} "${cat.query}"${profileNote}`);
    const { places: tilePlaces, tileCounts } = await searchGooglePlacesTyped(cat, cityWithTiling);
    const seenPlaceIds = new Set(tilePlaces.map((p) => p.place_id));

    const neighborhoodQueries = (city as { neighborhoodQueries?: { query: string; category: string; neighborhood: string }[] }).neighborhoodQueries ?? [];
    const nqsForCat = neighborhoodQueries.filter((nq) => nq.category === cat.category);
    let neighborhoodPlaces: GooglePlace[] = [];
    for (const nq of nqsForCat) {
      const extra = await searchGooglePlacesNeighborhood(
        nq.query,
        cat,
        cityWithTiling,
        seenPlaceIds,
        15
      );
      for (const p of extra) seenPlaceIds.add(p.place_id);
      neighborhoodPlaces = neighborhoodPlaces.concat(extra);
      if (extra.length > 0) console.log(`   + ${nq.neighborhood}: ${extra.length} from "${nq.query}"`);
      await new Promise((r) => setTimeout(r, 200));
    }

    const places = [...tilePlaces, ...neighborhoodPlaces];
    console.log(`   Found ${tilePlaces.length} (tiles) + ${neighborhoodPlaces.length} (neighborhoods) = ${places.length} places`);
    const tileEntries = Object.entries(tileCounts).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
    if (tileEntries.length > 0) {
      const tileStr = tileEntries.map(([k, v]) => `${k}:${v}`).join(" ");
      console.log(`   Per-tile: ${tileStr}`);
    }
    totalFetched += places.length;

    const existingByPlaceId = INCREMENTAL && places.length > 0
      ? await batchGetExistingVenues(places.map((p) => p.place_id), city)
      : new Map<string, { id: string; neighborhood: string | null; foursquare_id: string | null; website_url: string | null }>();

    for (const place of places) {
      const existing = INCREMENTAL ? existingByPlaceId.get(place.place_id) ?? null : null;
      const skipEnrichment = INCREMENTAL && !!existing?.foursquare_id;

      let fsq: FoursquareData | null = null;
      let resolvedNeighborhood: string;
      let venueId: string | null;
      let website: string | null = null;
      let priceUsd: number | null = null;
      let fsqDescription: string | null | undefined = undefined;

      if (skipEnrichment && existing) {
        resolvedNeighborhood = existing.neighborhood ?? cityName;
        venueId = existing.id;
        website = existing.website_url ?? null;
        totalSkipped++;
      } else {
        const fsqId = await searchFoursquarePlace(
          place.name,
          place.geometry.location.lat,
          place.geometry.location.lng
        );
        fsq = fsqId ? await getFoursquareDetails(fsqId, city) : null;
        if (fsqId && fsq) await new Promise((r) => setTimeout(r, 200));

        resolvedNeighborhood = await resolveNeighborhood(place, city, fsq);
        const canonicalKey = computeCanonicalKey(place, fsq);
        // Do NOT merge by canonical_key: distinct businesses at same address would overwrite each other.
        // Use google_place_id as sole identity. See migration 041, DATA-QUALITY-AND-PERFORMANCE §5.

        const shouldFetchTips = fsq && !!fsqId;
        if (shouldFetchTips && fsq) {
          fsq.tips = await getFoursquareTips(fsqId);
          if (fsq.tips.length > 0) await new Promise((r) => setTimeout(r, 150));
        }

        venueId = await upsertVenue(place, resolvedNeighborhood, fsq, city, canonicalKey);
        website = fsq?.website ?? null;
        priceUsd = fsqPriceToUsd(fsq?.price ?? null);
        fsqDescription = fsq?.description;
      }

      if (venueId) {
        await upsertHighlight(venueId, place, cat.category, resolvedNeighborhood, website, priceUsd, city, fsqDescription);
        totalSaved++;
        perCategoryCounts.set(cat.category, (perCategoryCounts.get(cat.category) ?? 0) + 1);
        neighborhoodCounts.set(resolvedNeighborhood, (neighborhoodCounts.get(resolvedNeighborhood) ?? 0) + 1);
        const fsqStr = fsq?.rating != null ? `, ${fsq.rating}⭐ (FSQ)` : skipEnrichment ? " [skipped]" : "";
        console.log(`   ✅ ${place.name} (${resolvedNeighborhood}${fsqStr})`);
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    console.log();
  }

  const finishedAt = new Date();
  await supabase.from("ingestion_jobs").insert({
    source: city.dbId ? `ingest-places-typed:${city.dbId}` : `ingest-places-typed:${city.id}`,
    status: "success",
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    items_fetched: totalFetched,
    items_successful: totalSaved,
    run_metadata: {
      google_calls: googleCallsMade,
      fsq_calls: fsqCallsMade,
      city_slug: citySlug ?? city.id,
    },
  });

  console.log(`\n✨ Done! Fetched ${totalFetched}, saved ${totalSaved}${totalSkipped > 0 ? `, skipped ${totalSkipped} (incremental)` : ""}.`);
  console.log(`   📊 API calls — Google: ${googleCallsMade}, Foursquare: ${fsqCallsMade} (record in docs/COST-LOG.md)`);
  console.log("   Per category:", Object.fromEntries(perCategoryCounts));
  const neighEntries = [...neighborhoodCounts.entries()].sort((a, b) => b[1] - a[1]);
  if (neighEntries.length > 0) {
    const topNeigh = neighEntries.slice(0, 15).map(([n, c]) => `${n}:${c}`).join(", ");
    console.log(`   Per neighborhood (top 15): ${topNeigh}`);
  }
}

main().catch(console.error);

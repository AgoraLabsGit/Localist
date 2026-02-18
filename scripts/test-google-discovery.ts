/**
 * Google API discovery tests — optimize query strategy before locking pipeline.
 * Focus: cafes, BA, problem tile (4-4 Villa Urquiza) vs control (2-2 center).
 *
 * Usage:
 *   npm run test:google-discovery buenos-aires 24
 *   npm run test:google-discovery buenos-aires 24 -- --strategy=minimal
 *   npm run test:google-discovery buenos-aires -- --both-tiles
 *   npm run test:google-discovery buenos-aires 24 -- --targets="Chicama,Bilbo,Crisol"
 *   npm run test:google-discovery buenos-aires 24 -- --strategies=best-city,minimal,neighborhood
 *   npm run test:google-discovery buenos-aires 24 -- --maxPages=5
 *
 * Always writes JSON: discovery-{timestamp}.json + discovery-latest.json
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { loadCityFromDb } from "./lib/load-city-from-db";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import {
  CAFE_STRATEGIES,
  CAFE_ANCHORS_VILLA_URQUIZA,
} from "./config/google-discovery-profiles";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FIELD_MASK =
  "places.id,places.displayName,places.location,places.formattedAddress,places.addressComponents,places.rating,places.userRatingCount,places.types,places.primaryType,nextPageToken";

const MAIN_GATE = { minRating: 4.1, minReviews: 6 };
const RELAXED_GATE = { minRating: 3.8, minReviews: 1 };

type StrategyName =
  | "best-city"
  | "city-no-best"
  | "minimal"
  | "type-only"
  | "text-only"
  | "neighborhood";

interface PlaceRecord {
  place_id: string;
  name: string;
  rating: number | null;
  user_rating_count: number | null;
  formatted_address: string | null;
  main_gate_pass: boolean;
  relaxed_gate_pass: boolean;
}

interface StrategyResult {
  summary: {
    raw_count: number;
    main_gate_count: number;
    relaxed_gate_count: number;
    api_calls: number;
  };
  places: PlaceRecord[];
}

interface DiscoveryRunJson {
  metadata: {
    city: string;
    city_slug: string;
    tile_id: number;
    tile_center?: { lat: number; lng: number };
    category_group: string;
    max_pages: number;
    strategies: string[];
    timestamp_utc: string;
    google_field_mask: string;
    google_rank_preference: string;
  };
  targets: {
    names: string[];
    matches: Record<string, string[]>;
  };
  strategies: Record<string, StrategyResult>;
  overlap: {
    by_pair: Record<
      string,
      { intersection_count: number; [key: string]: number }
    >;
    global: { unique_place_ids: number };
  };
}

interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
}

function mapPlace(p: Record<string, unknown>): GooglePlace {
  return {
    place_id: (p.id as string) ?? "",
    name: ((p.displayName as { text?: string })?.text as string) ?? "",
    formatted_address: p.formattedAddress as string | undefined,
    geometry: {
      location: {
        lat: (p.location as { latitude?: number })?.latitude ?? 0,
        lng: (p.location as { longitude?: number })?.longitude ?? 0,
      },
    },
    rating: (p.rating as number) | undefined,
    user_ratings_total: (p.userRatingCount as number) | undefined,
  };
}

function passesGate(place: GooglePlace, minRating: number, minReviews: number): boolean {
  const r = place.rating ?? 0;
  const n = place.user_ratings_total ?? 0;
  return r >= minRating && n >= minReviews;
}

function targetMatchesPlace(placeName: string, target: string): boolean {
  const n = placeName.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  return n.includes(t) || t.includes(n);
}

async function fetchStrategy(
  pattern: { includedType?: string; textQuery: string },
  tile: { lat: number; lng: number; radiusMeters: number },
  maxPages: number
): Promise<{ places: GooglePlace[]; apiCalls: number }> {
  const raw: GooglePlace[] = [];
  let pageToken: string | undefined;
  let apiCalls = 0;

  for (let page = 0; page < maxPages; page++) {
    const body: Record<string, unknown> = {
      textQuery: pattern.textQuery || " ",
      locationBias: {
        circle: {
          center: { latitude: tile.lat, longitude: tile.lng },
          radius: tile.radiusMeters,
        },
      },
      maxResultCount: 20,
    };
    if (pattern.includedType) {
      body.includedType = pattern.includedType;
      body.strictTypeFiltering = true;
    }
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
    apiCalls++;
    const data = await res.json();
    if (data.error) break;

    const pagePlaces = (data.places ?? []).map((p: Record<string, unknown>) => mapPlace(p));
    raw.push(...pagePlaces);
    pageToken = data.nextPageToken ?? undefined;
    if (!pageToken || pagePlaces.length === 0) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  return { places: raw, apiCalls };
}

function buildTile(
  city: { center: { lat: number; lng: number }; radiusMeters: number },
  tileIndex: number,
  rows: number,
  cols: number
) {
  const tileRadius = Math.ceil(city.radiusMeters / Math.max(rows, cols));
  const radiusDegLat = city.radiusMeters / 111320;
  const radiusDegLng =
    city.radiusMeters / (111320 * Math.cos((city.center.lat * Math.PI) / 180));
  const latStep = rows > 1 ? (2 * radiusDegLat) / (rows - 1) : 0;
  const lngStep = cols > 1 ? (2 * radiusDegLng) / (cols - 1) : 0;
  const startLat = city.center.lat - radiusDegLat;
  const startLng = city.center.lng - radiusDegLng;
  const r = Math.floor(tileIndex / cols);
  const c = tileIndex % cols;
  return {
    lat: startLat + r * latStep,
    lng: startLng + c * lngStep,
    radiusMeters: Math.ceil(tileRadius * 1.3),
    row: r,
    col: c,
  };
}

function toPlaceRecord(p: GooglePlace): PlaceRecord {
  const main = passesGate(p, MAIN_GATE.minRating, MAIN_GATE.minReviews);
  const relaxed =
    main || passesGate(p, RELAXED_GATE.minRating, RELAXED_GATE.minReviews);
  return {
    place_id: p.place_id,
    name: p.name,
    rating: p.rating ?? null,
    user_rating_count: p.user_ratings_total ?? null,
    formatted_address: p.formatted_address ?? null,
    main_gate_pass: main,
    relaxed_gate_pass: relaxed,
  };
}

function computeOverlap(
  strategyResults: Record<string, StrategyResult>
): DiscoveryRunJson["overlap"] {
  const byStrategy = new Map<string, Set<string>>();
  for (const [name, res] of Object.entries(strategyResults)) {
    byStrategy.set(name, new Set(res.places.map((p) => p.place_id)));
  }
  const allIds = new Set<string>();
  for (const s of byStrategy.values()) {
    for (const id of s) allIds.add(id);
  }

  const by_pair: DiscoveryRunJson["overlap"]["by_pair"] = {};
  const names = Array.from(byStrategy.keys());
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i];
      const b = names[j];
      const setA = byStrategy.get(a)!;
      const setB = byStrategy.get(b)!;
      let intersection = 0;
      for (const id of setA) {
        if (setB.has(id)) intersection++;
      }
      const aOnly = setA.size - intersection;
      const bOnly = setB.size - intersection;
      by_pair[`${a}|${b}`] = {
        intersection_count: intersection,
        [`${a}_only_count`]: aOnly,
        [`${b}_only_count`]: bOnly,
      };
    }
  }

  return {
    by_pair,
    global: { unique_place_ids: allIds.size },
  };
}

function computeTargetMatches(
  strategyResults: Record<string, StrategyResult>,
  targetNames: string[]
): Record<string, string[]> {
  const matches: Record<string, string[]> = {};
  for (const target of targetNames) {
    matches[target] = [];
    for (const [strategy, res] of Object.entries(strategyResults)) {
      const found = res.places.some((p) => targetMatchesPlace(p.name, target));
      if (found) matches[target].push(strategy);
    }
  }
  return matches;
}

async function runOneTile(
  city: { center: { lat: number; lng: number }; radiusMeters: number; name: string },
  strategies: { id: string; pattern: { includedType?: string; textQuery: string } }[],
  tileIndex: number,
  maxPages: number
): Promise<{ strategyResults: Record<string, StrategyResult>; tileCenter: { lat: number; lng: number } }> {
  const rows = 5;
  const cols = 5;
  const tile = buildTile(city, tileIndex, rows, cols);

  const strategyResults: Record<string, StrategyResult> = {};

  for (const s of strategies) {
    const { places, apiCalls } = await fetchStrategy(s.pattern, tile, maxPages);
    const byId = new Map<string, GooglePlace>();
    for (const p of places) byId.set(p.place_id, p);
    const unique = Array.from(byId.values());

    const placeRecords = unique.map(toPlaceRecord);
    const mainGateCount = placeRecords.filter((p) => p.main_gate_pass).length;
    const relaxedGateCount = placeRecords.filter((p) => p.relaxed_gate_pass).length;

    strategyResults[s.id] = {
      summary: {
        raw_count: unique.length,
        main_gate_count: mainGateCount,
        relaxed_gate_count: relaxedGateCount,
        api_calls: apiCalls,
      },
      places: placeRecords,
    };
    await new Promise((r) => setTimeout(r, 300));
  }

  return {
    strategyResults,
    tileCenter: { lat: tile.lat, lng: tile.lng },
  };
}

async function main() {
  if (!GOOGLE_API_KEY) {
    console.error("❌ GOOGLE_PLACES_API_KEY required");
    process.exit(1);
  }

  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const has = (flag: string) =>
    process.argv.some((a) => a === flag || a.startsWith(flag + "="));
  const getFlag = (flag: string) => {
    const arg = process.argv.find((a) => a === flag || a.startsWith(flag + "="));
    if (!arg) return null;
    if (arg.includes("=")) return arg.split("=")[1];
    const i = process.argv.indexOf(arg);
    return process.argv[i + 1] ?? null;
  };

  const citySlug = args[0] ?? "buenos-aires";
  const tileArg = args[1];
  const bothTiles = has("--both-tiles");
  const strategyFilter = getFlag("--strategy");
  const strategiesArg = getFlag("--strategies");
  const targetsArg = getFlag("--targets");
  const maxPagesArg = getFlag("--maxPages");
  const chicamaDebug = has("--chicama-debug");

  const maxPages = maxPagesArg ? parseInt(maxPagesArg, 10) : 3;
  const targetNames = targetsArg
    ? targetsArg.split(",").map((s) => s.trim()).filter(Boolean)
    : ["Chicama", "Bilbo", "Crisol Villa Urquiza", "Dorina", "Porta negra"];

  let strategiesToRun = CAFE_STRATEGIES;
  if (chicamaDebug) {
    strategiesToRun = strategiesToRun.filter(
      (s) => s.id === "minimal" || s.id === "neighborhood"
    );
  }
  if (strategyFilter) {
    strategiesToRun = strategiesToRun.filter((s) => s.id === strategyFilter);
  } else if (strategiesArg && !chicamaDebug) {
    const ids = strategiesArg.split(",").map((s) => s.trim());
    strategiesToRun = strategiesToRun.filter((s) => ids.includes(s.id));
  }

  const city = await loadCityFromDb(supabase, citySlug);
  if (!city) {
    console.error(`❌ City not found: ${citySlug}`);
    process.exit(1);
  }

  const tiles = bothTiles
    ? [
        { index: 24, label: "problem (4-4 Villa Urquiza)" },
        { index: 12, label: "control (2-2 center)" },
      ]
    : [{ index: parseInt(tileArg ?? "24", 10), label: `tile ${tileArg ?? "24"}` }];

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 23);
  const dir = join(process.cwd(), "scripts", "test-results");
  mkdirSync(dir, { recursive: true });

  for (const t of tiles) {
    const { strategyResults, tileCenter } = await runOneTile(
      city,
      strategiesToRun,
      t.index,
      maxPages
    );

    const overlap = computeOverlap(strategyResults);
    const targetMatches = computeTargetMatches(strategyResults, targetNames);

    const runObject: DiscoveryRunJson = {
      metadata: {
        city: city.name,
        city_slug: citySlug,
        tile_id: t.index,
        tile_center: tileCenter,
        category_group: "cafe",
        max_pages: maxPages,
        strategies: Object.keys(strategyResults),
        timestamp_utc: new Date().toISOString(),
        google_field_mask: FIELD_MASK,
        google_rank_preference: "RELEVANCE",
      },
      targets: {
        names: targetNames,
        matches: targetMatches,
      },
      strategies: strategyResults,
      overlap,
    };

    const runFile = join(dir, `discovery-${timestamp}-tile${t.index}.json`);
    const latestFile = join(dir, "discovery-latest.json");
    const jsonStr = JSON.stringify(runObject, null, 2);
    writeFileSync(runFile, jsonStr, "utf-8");
    if (t.index === 24 || tiles.length === 1) {
      writeFileSync(latestFile, jsonStr, "utf-8");
    }

    console.log(`\n🧪 Google discovery: ${city.name} | cafe | ${t.label}`);
    console.log(`   Gates: main ${MAIN_GATE.minRating}+/${MAIN_GATE.minReviews}+ | relaxed ${RELAXED_GATE.minRating}+/${RELAXED_GATE.minReviews}+`);
    console.log(`   Pages: ${maxPages} | Strategies: ${Object.keys(strategyResults).join(", ")}\n`);

    console.log("Strategy          | Raw | Main | Relaxed | API");
    console.log("-".repeat(55));
    for (const [id, res] of Object.entries(strategyResults)) {
      const s = res.summary;
      console.log(
        `${id.padEnd(17)} | ${String(s.raw_count).padStart(3)} | ${String(s.main_gate_count).padStart(4)} | ${String(s.relaxed_gate_count).padStart(7)} | ${s.api_calls}`
      );
    }

    console.log("\n📌 Target matches:");
    for (const [target, found] of Object.entries(targetMatches)) {
      console.log(`   ${target}: ${found.length > 0 ? found.join(", ") : "—"}`);
    }

    // Chicama debug: log whether minimal+neighborhood surface Chicama (acceptance test)
    if (chicamaDebug) {
      const minimal = strategyResults["minimal"]?.places ?? [];
      const neighborhood = strategyResults["neighborhood"]?.places ?? [];
      const chicamaInMinimal = minimal.filter((p) =>
        p.name.toLowerCase().includes("chicama")
      );
      const chicamaInNeighborhood = neighborhood.filter((p) =>
        p.name.toLowerCase().includes("chicama")
      );
      console.log("\n🔍 Chicama acceptance test:");
      console.log(`   minimal: Chicama found: ${chicamaInMinimal.length ? chicamaInMinimal.map((p) => p.name).join(", ") : "NO"}`);
      console.log(`   neighborhood: Chicama found: ${chicamaInNeighborhood.length ? chicamaInNeighborhood.map((p) => p.name).join(", ") : "NO"}`);
    }

    console.log(`\n📁 Wrote ${runFile}`);
    if (t.index === 24 || tiles.length === 1) {
      console.log(`📁 Wrote ${latestFile}`);
    }
  }
  console.log();
}

main().catch(console.error);

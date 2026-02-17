/**
 * Generic: Sync neighborhoods from GeoJSON for any city.
 * Reads geojson_source_url and geojson_name_property from cities table.
 * Override with --url and --property if not set in DB.
 *
 * Usage:
 *   npx tsx scripts/sync-neighborhoods-from-geojson.ts [city-slug]
 *   npx tsx scripts/sync-neighborhoods-from-geojson.ts buenos-aires
 *   npx tsx scripts/sync-neighborhoods-from-geojson.ts lisbon --url https://... --property properties.name
 *
 * Requires: migration 026 (geojson_source_url, geojson_name_property)
 * Run after: seed-cities (city must exist)
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { getDefaultCitySlug, listCitySlugsFromDb } from "./lib/load-city-from-db";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

/** Title case for storage: "LINIERS" → "Liniers". Avoids \\b\\w so accented chars (ó, ñ) don't trigger spurious caps. */
function toTitleCase(name: string): string {
  let result = "";
  let startOfWord = true;
  for (const c of name.toLowerCase()) {
    if (/\s/.test(c)) {
      startOfWord = true;
      result += c;
    } else {
      result += startOfWord ? c.toUpperCase() : c;
      startOfWord = false;
    }
  }
  return result;
}

function toSlug(name: string): string {
  return normalizeName(name)
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Get value from object by dot path, e.g. "properties.BARRIO" */
function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const p of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[p];
  }
  return current;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const urlArg = process.argv.find((a) => a.startsWith("--url="));
  const propArg = process.argv.find((a) => a.startsWith("--property="));

  const citySlug = args[0] ?? (await getDefaultCitySlug(supabase));

  const { data: city, error: cityErr } = await supabase
    .from("cities")
    .select("id, name, geojson_source_url, geojson_name_property")
    .eq("slug", citySlug)
    .eq("status", "active")
    .single();

  if (cityErr || !city) {
    const slugs = await listCitySlugsFromDb(supabase);
    console.error(`❌ City "${citySlug}" not found. Available: ${slugs.join(", ")}`);
    process.exit(1);
  }

  const geojsonUrl = urlArg ? urlArg.split("=")[1] : city.geojson_source_url;
  const nameProperty = propArg ? propArg.split("=")[1] : city.geojson_name_property ?? "properties.name";

  if (!geojsonUrl) {
    console.error(`❌ No GeoJSON URL. Set cities.geojson_source_url or pass --url=https://...`);
    process.exit(1);
  }

  console.log(`\n🗺️  Syncing neighborhoods for ${city.name} from GeoJSON...\n`);

  const res = await fetch(geojsonUrl);
  if (!res.ok) {
    console.error(`❌ Failed to fetch GeoJSON: ${res.status}`);
    process.exit(1);
  }

  const geojson = (await res.json()) as { type: string; features?: unknown[] };

  if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
    console.error("❌ Invalid GeoJSON: expected FeatureCollection with features array");
    process.exit(1);
  }

  const nameToId = new Map<string, string>();
  const existing = await supabase
    .from("city_neighborhoods")
    .select("id, name")
    .eq("city_id", city.id);
  for (const n of existing.data ?? []) {
    nameToId.set(normalizeName(n.name), n.id);
  }

  let added = 0;
  let updatedGeom = 0;

  for (const feature of geojson.features) {
    const raw = getByPath(feature, nameProperty);
    const name = typeof raw === "string" ? raw.trim() : raw != null ? String(raw).trim() : "";
    if (!name) continue;

    const norm = normalizeName(name);
    let neighborhoodId = nameToId.get(norm);

    if (!neighborhoodId) {
      const displayName = toTitleCase(name);
      const { data: inserted, error: insErr } = await supabase
        .from("city_neighborhoods")
        .insert({
          city_id: city.id,
          name: displayName,
          slug: toSlug(displayName),
        })
        .select("id")
        .single();

      if (insErr) {
        console.error(`  ⚠️ ${name}: insert failed ${insErr.message}`);
        continue;
      }
      neighborhoodId = inserted.id;
      nameToId.set(norm, neighborhoodId);
      added++;
      console.log(`  ➕ Added: ${name}`);
    }

    const geom = (feature as { geometry?: { type?: string; coordinates?: unknown } }).geometry;
    if (geom?.type === "MultiPolygon" && Array.isArray(geom.coordinates)) {
      const rings = geom.coordinates as number[][][][];
      const wkt = `MULTIPOLYGON(${rings
        .map((ring) => `((${ring[0].map((c) => `${c[0]} ${c[1]}`).join(",")}))`)
        .join(",")})`;

      const { error: updateErr } = await supabase.rpc("update_neighborhood_geom", {
        p_id: neighborhoodId,
        p_wkt: wkt,
      });

      if (!updateErr) updatedGeom++;
    } else if (geom?.type === "Polygon" && Array.isArray(geom.coordinates)) {
      const ring = (geom.coordinates as number[][][])[0];
      const wkt = `MULTIPOLYGON(((${ring.map((c) => `${c[0]} ${c[1]}`).join(",")})))`;
      const { error: updateErr } = await supabase.rpc("update_neighborhood_geom", {
        p_id: neighborhoodId,
        p_wkt: wkt,
      });
      if (!updateErr) updatedGeom++;
    }
  }

  console.log(`\n✨ Done. Added: ${added}, Geom updated: ${updatedGeom}`);
  console.log(`   Total neighborhoods: ${nameToId.size}\n`);
}

main().catch(console.error);

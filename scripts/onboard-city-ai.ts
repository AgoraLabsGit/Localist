/**
 * AI city onboarding — generate CityConfig for a new city.
 *
 * Usage:
 *   npx tsx scripts/onboard-city-ai.ts "Lisbon"
 *   npx tsx scripts/onboard-city-ai.ts "Tokyo" --save
 *
 * Requires: OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local
 * --save: Insert generated config into DB (run seed-cities after to add to config and re-seed)
 *
 * Output: Suggested CityConfig JSON. Review before adding to scripts/config/cities.ts
 * or use the admin UI + API to add categories/neighborhoods manually.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const cityName = process.argv[2];
const shouldSave = process.argv.includes("--save");
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const PROMPT = `You are helping define a city config for a place-discovery app. Given a city name, produce a JSON object matching this schema:

{
  "id": "slug (lowercase, hyphenated, e.g. lisbon)",
  "name": "Full city name",
  "center": { "lat": number, "lng": number },
  "radiusMeters": 15000,
  "neighborhoods": ["Neighborhood1", "Neighborhood2", ...],
  "categories": [
    { "query": "best X CityName", "category": "slug", "isCitySpecific": boolean }
  ],
  "neighborhoodQueries": [
    { "query": "best X Neighborhood", "category": "slug", "neighborhood": "Neighborhood" }
  ],
  "geocodeLanguage": "en or local code"
}

Rules:
- Include 15-25 well-known neighborhoods/districts
- Categories: mix universal (cafe, cocktail_bar, museum, brunch) and city-specific (e.g. fado_bar for Lisbon, jazz_bar for New Orleans, ramen for Tokyo)
- Each category needs a search_query that works for Google Places (e.g. "best fado bar Lisbon")
- neighborhoodQueries: for 5-10 underrepresented neighborhoods, add 1-2 queries each (e.g. "best cafe Alfama" for Lisbon)
- isCitySpecific: true for categories unique to that city
- Return ONLY valid JSON, no markdown or explanation`;

async function callLLM(city: string): Promise<string> {
  if (OPENAI_KEY) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: PROMPT },
          { role: "user", content: `City: ${city}` },
        ],
        temperature: 0.3,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  }

  if (ANTHROPIC_KEY) {
    const res = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: PROMPT,
          messages: [{ role: "user", content: `City: ${city}` }],
        }),
      }
    );
    if (!res.ok) throw new Error(`Anthropic: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const text = data.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
    return text;
  }

  throw new Error("Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local");
}

function parseJson(text: string): object {
  // Strip markdown code blocks if present
  let cleaned = text.trim();
  const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) cleaned = match[1].trim();
  return JSON.parse(cleaned) as object;
}

async function saveToDb(parsed: Record<string, unknown>) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const id = String(parsed.id ?? "").toLowerCase().replace(/\s+/g, "-");
  const name = String(parsed.name ?? "");
  const center = parsed.center as { lat: number; lng: number };
  const radiusMeters = Number(parsed.radiusMeters) || 15000;
  const geocodeLanguage = String(parsed.geocodeLanguage ?? "en");
  const neighborhoods = (parsed.neighborhoods as string[]) ?? [];
  const categories = (parsed.categories as Array<{ query: string; category: string; isCitySpecific?: boolean }>) ?? [];
  const neighborhoodQueries = (parsed.neighborhoodQueries as Array<{ query: string; category: string; neighborhood: string }>) ?? [];

  const { data: city, error: cityErr } = await supabase
    .from("cities")
    .insert({
      slug: id,
      name,
      center_lat: center.lat,
      center_lng: center.lng,
      radius_meters: radiusMeters,
      geocode_language: geocodeLanguage,
      status: "active",
    })
    .select("id")
    .single();

  if (cityErr) {
    if (cityErr.code === "23505") {
      console.error(`City ${id} already exists. Update via admin.`);
      return;
    }
    throw cityErr;
  }
  const cityId = city.id;

  for (const n of neighborhoods) {
    await supabase.from("city_neighborhoods").upsert(
      { city_id: cityId, name: n },
      { onConflict: "city_id,name" }
    );
  }

  const categoryIdBySlug: Record<string, string> = {};
  for (const c of categories) {
    const group =
      ["parrilla", "heladeria", "brunch", "cajun", "po_boy"].includes(c.category) ? "restaurant" :
      ["cocktail_bar", "rooftop", "tango_bar", "wine_bar", "jazz_bar", "fado_bar"].includes(c.category) ? "bar" :
      c.category === "cafe" ? "cafe" :
      c.category === "museum" ? "museum" : "other";

    const { data: cat } = await supabase
      .from("city_categories")
      .upsert({
        city_id: cityId,
        slug: c.category,
        display_name: c.category.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()),
        search_query: c.query,
        min_rating: 4.5,
        category_group: group,
        is_city_specific: c.isCitySpecific ?? false,
      }, { onConflict: "city_id,slug" })
      .select("id")
      .single();
    if (cat) categoryIdBySlug[c.category] = cat.id;
  }

  for (const nq of neighborhoodQueries) {
    const catId = categoryIdBySlug[nq.category];
    if (!catId) continue;
    await supabase.from("city_neighborhood_queries").upsert({
      city_id: cityId,
      city_category_id: catId,
      neighborhood_name: nq.neighborhood,
      search_query: nq.query,
      min_rating: 4.3,
    }, { onConflict: "city_id,city_category_id,neighborhood_name" });
  }

  console.log(`\n✅ Saved to DB. Run: npx tsx scripts/ingest-places.ts ${id}`);
}

async function main() {
  if (!cityName) {
    console.log("Usage: npx tsx scripts/onboard-city-ai.ts \"City Name\" [--save]");
    process.exit(1);
  }

  console.log(`\n🤖 Generating city config for "${cityName}"...\n`);
  const raw = await callLLM(cityName);
  const parsed = parseJson(raw);

  console.log("Generated config:\n");
  console.log(JSON.stringify(parsed, null, 2));

  if (shouldSave) {
    console.log("\nSaving to DB...");
    await saveToDb(parsed);
  } else {
    console.log("\nReview the output. Add to scripts/config/cities.ts or run with --save to insert into DB.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

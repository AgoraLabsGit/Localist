import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { expandUniversalCategories, getCategoryGroup, UNIVERSAL_CATEGORIES } from "@/lib/universal-categories";

const PROMPT = `You are helping define a city config for a place-discovery app. Given a city name, produce a JSON object matching this schema:

{
  "id": "slug (lowercase, hyphenated, e.g. lisbon)",
  "name": "Full city name",
  "center": { "lat": number, "lng": number },
  "radiusMeters": 15000,
  "targetVenues": 150,
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
- targetVenues: 100 for small cities (<500K pop), 150 for medium, 250 for large (2M+)
- Include 15-25 well-known neighborhoods/districts
- Categories: suggest ONLY city-specific (e.g. fado_bar for Lisbon, jazz_bar for New Orleans). Universal categories (cafe, museum, park, etc.) are added automatically.
- Each category needs a search_query that works for Google Places
- neighborhoodQueries: for 5-10 neighborhoods, add 1-2 queries each
- isCitySpecific: true for categories unique to that city
- Return ONLY valid JSON, no markdown`;

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const cityName = String(body?.cityName ?? "").trim();
  if (!cityName) {
    return NextResponse.json({ error: "cityName required" }, { status: 400 });
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  let raw: string;
  try {
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
            { role: "user", content: `City: ${cityName}` },
          ],
          temperature: 0.3,
        }),
      });
      if (!res.ok) throw new Error(`OpenAI: ${res.status}`);
      const data = await res.json();
      raw = data.choices?.[0]?.message?.content?.trim() ?? "";
    } else if (ANTHROPIC_KEY) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
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
          messages: [{ role: "user", content: `City: ${cityName}` }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic: ${res.status}`);
      const data = await res.json();
      raw = data.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
    } else {
      return NextResponse.json(
        { error: "Set OPENAI_API_KEY or ANTHROPIC_API_KEY" },
        { status: 500 }
      );
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "LLM request failed" },
      { status: 500 }
    );
  }

  let parsed: Record<string, unknown>;
  try {
    let cleaned = raw.trim();
    const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) cleaned = match[1].trim();
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON from LLM" }, { status: 500 });
  }

  const save = body.save === true;
  if (!save) {
    return NextResponse.json({ config: parsed });
  }

  const id = String(parsed.id ?? "").toLowerCase().replace(/\s+/g, "-");
  const name = String(parsed.name ?? "");
  const center = parsed.center as { lat: number; lng: number };
  const radiusMeters = Number(parsed.radiusMeters) || 15000;
  const targetVenues = Number(parsed.targetVenues) || 150;
  const geocodeLanguage = String(parsed.geocodeLanguage ?? "en");
  const neighborhoods = (parsed.neighborhoods as string[]) ?? [];
  const aiCategories = (parsed.categories as Array<{ query: string; category: string; isCitySpecific?: boolean }>) ?? [];
  // Merge universal categories + AI city-specific (avoid duplicates)
  const universalSlugs = new Set(UNIVERSAL_CATEGORIES.map((u) => u.category));
  const citySpecific = aiCategories.filter((c) => !universalSlugs.has(c.category));
  const categories = [...expandUniversalCategories(name), ...citySpecific];
  const neighborhoodQueries = (parsed.neighborhoodQueries as Array<{ query: string; category: string; neighborhood: string }>) ?? [];

  const { data: city, error: cityErr } = await supabase
    .from("cities")
    .insert({
      slug: id,
      name,
      center_lat: center.lat,
      center_lng: center.lng,
      radius_meters: radiusMeters,
      target_venues: targetVenues,
      geocode_language: geocodeLanguage,
      status: "active",
    })
    .select("id")
    .single();

  if (cityErr) {
    if (cityErr.code === "23505") {
      return NextResponse.json({ error: `City ${id} already exists` }, { status: 409 });
    }
    return NextResponse.json({ error: cityErr.message }, { status: 500 });
  }
  const cityId = city.id;

  for (const n of neighborhoods) {
    await supabase.from("city_neighborhoods").upsert(
      { city_id: cityId, name: n },
      { onConflict: "city_id,name" }
    );
  }

  const universalBySlug = Object.fromEntries(UNIVERSAL_CATEGORIES.map((u) => [u.category, u]));
  const categoryIdBySlug: Record<string, string> = {};
  for (const c of categories) {
    const universal = universalBySlug[c.category];
    const group = getCategoryGroup(c.category);
    const displayName = universal?.displayName ?? c.category.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());

    const { data: cat } = await supabase
      .from("city_categories")
      .upsert({
        city_id: cityId,
        slug: c.category,
        display_name: displayName,
        search_query: c.query,
        min_rating: (c as { minRating?: number }).minRating ?? 4.5,
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

  return NextResponse.json({ slug: id, message: "City saved. Run ingest." });
}

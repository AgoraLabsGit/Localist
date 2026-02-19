/**
 * AI venue enrichment — generate short_description, vibe_tags, concierge_rationale
 * from Foursquare tips, categories, and ratings.
 *
 * **Separate batch layer:** Run after ingest + scores. Does not block or couple to ingestion.
 * Per FSQ terms: tips are used only as input for derived data; never exposed as raw corpus.
 * All reads from DB; no Foursquare calls at runtime.
 *
 * Usage:
 *   npm run enrich:venues:ai [city-slug]
 *   npm run enrich:venues:ai buenos-aires -- --backfill   # re-process all (including already enriched)
 *
 * Requires: OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local
 * Only processes highlights whose venue has fsq_tips. Skips those with short_description (idempotent).
 * Processes all eligible highlights (no per-run cap). Cap: total active × 2, or MAX_ENRICH_ITEMS env.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { loadCityFromDb, getDefaultCitySlug } from "./lib/load-city-from-db";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const BATCH_SIZE = 15; // 10–20 places per API call
const BATCH_DELAY_MS = 500;
// Cap: total active highlights × 2 (safety buffer). Prevents runaway loops; we can't have more to enrich than exist.
// Override via MAX_ENRICH_ITEMS env if needed.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SYSTEM_PROMPT = `You are a Buenos Aires city guide. Given venue details (name, neighborhood, category, Foursquare tips, categories, Google types, rating), produce a JSON array of enrichment objects. One object per venue, in the same order.

Important: Synthesize in your own words. Do not quote, paraphrase, or copy tip text verbatim. Our descriptions must be original summaries.

Per venue:
- short_description: 1-2 sentences, max 250 chars. Capture vibe and what makes it special.
- vibe_tags: 3-6 internal tags (lowercase, underscored). Examples: third_wave_coffee, remote_work, loud, kid_friendly, date_night, cozy, local, touristy.
- concierge_rationale: One line for "Why this for tonight" — e.g. "Great for a cozy date-night dinner in Palermo with mid-range prices."
- avg_expected_price: 1-4 if you can infer (1=cheap, 2=mid, 3=$$$, 4=$$$$). Use null if unclear.

Return ONLY a valid JSON array, no markdown:
[{"short_description":"...","vibe_tags":["...","..."],"concierge_rationale":"...","avg_expected_price":2},...]`;

interface EnrichInput {
  name: string;
  neighborhood: string | null;
  category: string;
  city: string;
  fsq_tips: Array<{ text: string; likes?: number }>;
  fsq_categories: Array<{ name?: string }> | null;
  google_types: string[] | null;
  rating: number | null;
  rating_count: number | null;
  avg_expected_price: number | null;
  existing_description?: string | null;
}

function buildUserPrompt(inputs: EnrichInput[]): string {
  const entries = inputs.map((input, i) => {
    const tipsText =
      input.fsq_tips.length > 0
        ? input.fsq_tips
            .slice(0, 8)
            .map((t) => (t.likes != null ? `[${t.likes}👍] ${t.text}` : t.text))
            .join("\n")
        : "No tips available.";
    const catNames =
      Array.isArray(input.fsq_categories) && input.fsq_categories.length > 0
        ? input.fsq_categories.map((c) => c.name).filter(Boolean).join(", ")
        : input.category;
    const googleTypes =
      Array.isArray(input.google_types) && input.google_types.length > 0
        ? input.google_types.join(", ")
        : "";
    const ratingStr =
      input.rating != null
        ? `Rating: ${input.rating}/10 (${input.rating_count ?? "?"} reviews)`
        : "No rating";
    return `[${i + 1}] Venue: ${input.name}
  Neighborhood: ${input.neighborhood ?? "Unknown"}, ${input.city}
  Category: ${input.category}
  Categories: ${catNames}${googleTypes ? ` | Google types: ${googleTypes}` : ""}
  ${ratingStr}

  Foursquare tips:
  ${tipsText}`;
  });
  return `Enrich these ${inputs.length} venues. Return a JSON array with ${inputs.length} objects, one per venue in order.\n\n${entries.join("\n\n")}`;
}

interface EnrichOutput {
  short_description: string | null;
  vibe_tags: string[];
  concierge_rationale: string | null;
  avg_expected_price: number | null;
}

function parseEnrichOutputs(text: string, expectedCount: number): EnrichOutput[] {
  let cleaned = text.trim();
  const codeBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) cleaned = codeBlock[1].trim();
  else {
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (arrMatch) cleaned = arrMatch[0];
    else if (objMatch) cleaned = objMatch[0];
  }
  cleaned = cleaned.replace(/\*\*/g, "").replace(/^`+|`+$/g, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");
    parsed = JSON.parse(cleaned);
  }
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  return arr.slice(0, expectedCount).map((p: Record<string, unknown>) => ({
    short_description:
      typeof p.short_description === "string" && p.short_description.trim()
        ? p.short_description.trim().slice(0, 250)
        : null,
    vibe_tags: Array.isArray(p.vibe_tags)
      ? p.vibe_tags.filter((t): t is string => typeof t === "string").slice(0, 6)
      : [],
    concierge_rationale:
      typeof p.concierge_rationale === "string" && p.concierge_rationale.trim()
        ? p.concierge_rationale.trim().slice(0, 250)
        : null,
    avg_expected_price:
      typeof p.avg_expected_price === "number" &&
      p.avg_expected_price >= 1 &&
      p.avg_expected_price <= 4
        ? p.avg_expected_price
        : null,
  }));
}

async function callLLMBatch(inputs: EnrichInput[]): Promise<EnrichOutput[]> {
  const userPrompt = buildUserPrompt(inputs);

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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    return parseEnrichOutputs(text, inputs.length);
  }

  if (ANTHROPIC_KEY) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const text = data.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
    return parseEnrichOutputs(text, inputs.length);
  }

  throw new Error("Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local");
}

interface HighlightRow {
  id: string;
  title: string;
  short_description: string | null;
  category: string;
  neighborhood: string | null;
  avg_expected_price: number | null;
  venue: {
    id: string;
    name: string;
    neighborhood: string | null;
    fsq_tips?: Array<{ text: string; likes?: number }>;
    fsq_categories?: Array<{ name?: string }> | null;
    google_types?: string[] | null;
    rating: number | null;
    rating_count: number | null;
  };
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const citySlug = args[0] ?? (await getDefaultCitySlug(supabase));
  const BACKFILL = process.argv.includes("--backfill");

  if (!OPENAI_KEY && !ANTHROPIC_KEY) {
    console.error("❌ Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local");
    process.exit(1);
  }

  const city = await loadCityFromDb(supabase, citySlug);
  if (!city) {
    console.error(`❌ Unknown city: "${citySlug}". Run seed: npx tsx scripts/seed-cities.ts`);
    process.exit(1);
  }

  const cityName = city.cityFallbackName ?? city.name;

  const { count: totalActive } = await supabase
    .from("highlights")
    .select("id", { count: "exact", head: true })
    .eq("city", cityName)
    .eq("status", "active");

  const total = totalActive ?? 5000;
  const maxFetch = Math.min(Number(process.env.MAX_ENRICH_ITEMS) || total * 2, 10000);
  const PAGE_SIZE = 1000;

  const allHighlights: unknown[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    let q = supabase
      .from("highlights")
      .select(
        `
        id,
        title,
        short_description,
        category,
        neighborhood,
        avg_expected_price,
        venue:venues(
          id,
          name,
          neighborhood,
          fsq_tips,
          fsq_categories,
          google_types,
          rating,
          rating_count
        )
      `
      )
      .eq("city", cityName)
      .eq("status", "active")
      .range(offset, offset + PAGE_SIZE - 1);

    if (!BACKFILL) {
      q = q.is("short_description", null);
    }

    const { data: page, error } = await q;
    if (error) {
      console.error("❌ Query failed:", error.message);
      process.exit(1);
    }
    const rows = page ?? [];
    allHighlights.push(...rows);
    if (rows.length < PAGE_SIZE || allHighlights.length >= maxFetch) hasMore = false;
    else offset += PAGE_SIZE;
  }

  const highlights = allHighlights;

  const toEnrich = (highlights ?? []).filter((h) => {
    const v = Array.isArray((h as HighlightRow).venue) ? (h as HighlightRow).venue[0] : (h as HighlightRow).venue;
    if (!v) return false;
    const tips = v.fsq_tips;
    return Array.isArray(tips) && tips.length > 0;
  });

  const skipExisting = !BACKFILL;
  const filtered = skipExisting
    ? toEnrich.filter((h) => !(h.short_description && (h.short_description as string).trim()))
    : toEnrich;

  const startedAt = new Date();
  const batch = filtered;
  const modelUsed = OPENAI_KEY ? "gpt-4o-mini" : "claude-sonnet-4-20250514";
  console.log(
    `\n🤖 AI Enrichment: ${city.name}\n   Processing ${batch.length} highlights (of ${filtered.length} needing enrichment)\n   Batch size: ${BATCH_SIZE}, max API calls: ${Math.ceil(batch.length / BATCH_SIZE)}\n`
  );

  let done = 0;
  let errors = 0;
  let aiCallsUsed = 0;

  for (let i = 0; i < batch.length; i += BATCH_SIZE) {
    const chunk = batch.slice(i, i + BATCH_SIZE);
    const inputs: EnrichInput[] = chunk.map((h) => {
      const v = Array.isArray((h as HighlightRow).venue)
        ? (h as HighlightRow).venue[0]
        : (h as HighlightRow).venue;
      const ven = v!;
      return {
        name: ven.name ?? (h.title as string),
        neighborhood: ven.neighborhood ?? (h.neighborhood as string | null),
        category: h.category as string,
        city: cityName,
        fsq_tips: Array.isArray(ven.fsq_tips) ? ven.fsq_tips : [],
        fsq_categories: ven.fsq_categories ?? null,
        google_types: ven.google_types ?? null,
        rating: ven.rating ?? null,
        rating_count: ven.rating_count ?? null,
        avg_expected_price: (h.avg_expected_price as number | null) ?? null,
        existing_description: h.short_description as string | null,
      };
    });

    try {
      const outputs = await callLLMBatch(inputs);
      aiCallsUsed++;

      for (let j = 0; j < chunk.length; j++) {
        const h = chunk[j];
        const out = outputs[j];
        if (!out) continue;

        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (out.short_description) updates.short_description = out.short_description;
        if (out.vibe_tags.length > 0) updates.vibe_tags = out.vibe_tags;
        if (out.concierge_rationale) updates.concierge_rationale = out.concierge_rationale;
        if (out.avg_expected_price != null && h.avg_expected_price == null) {
          updates.avg_expected_price = out.avg_expected_price;
        }

        await supabase.from("highlights").update(updates).eq("id", h.id);
        done++;

        const v = Array.isArray((h as HighlightRow).venue)
          ? (h as HighlightRow).venue[0]
          : (h as HighlightRow).venue;
        const venName = v?.name ?? h.title;
        process.stdout.write(`   ✅ ${done}/${batch.length} ${venName}\r`);
      }
    } catch (err) {
      errors += chunk.length;
      console.error(`\n   ❌ Batch error: ${(err as Error).message}`);
    }

    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }

  const finishedAt = new Date();
  await supabase.from("pipeline_runs").insert({
    script: "enrich-venues-ai",
    city_slug: citySlug,
    status: "success",
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    items_processed: done,
    run_metadata: { ai_calls: aiCallsUsed, model: modelUsed },
  });

  console.log(
    `\n\n✨ Done! Enriched ${done} highlights${errors > 0 ? `, ${errors} errors` : ""}. AI calls used: ${aiCallsUsed} (of ${Math.ceil(batch.length / BATCH_SIZE)} max).`
  );
  console.log(`   📊 Record AI cost in docs/COST-LOG.md (OpenAI/Anthropic dashboard by date)`);
}

main().catch(console.error);

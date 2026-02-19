/**
 * AI venue enrichment from the WEB — for places without Foursquare tips.
 *
 * Priority: 1) Perplexity Sonar (web search), 2) Tavily + gpt-4o-mini, 3) gpt-4o-mini only (knowledge).
 *
 * Run AFTER enrich-venues-ai (which handles tip-rich places). This fills gaps.
 *
 * Usage:
 *   npm run enrich:venues:ai:web [city-slug]
 *   npm run enrich:venues:ai:web buenos-aires -- --backfill   # re-process no-tip places (overwrite existing)
 *
 * Requires one of:
 *   - PERPLEXITY_API_KEY (Perplexity Sonar, built-in web search) — recommended
 *   - TAVILY_API_KEY + OPENAI_API_KEY (web search + gpt-4o-mini)
 *   - OPENAI_API_KEY only (knowledge-based, no live web)
 * Processes all eligible highlights (no per-run cap). Cap: total active × 2 (max 5K), or MAX_ENRICH_WEB_ITEMS env.
 */

import { config } from "dotenv";
import { join } from "path";
config({ path: join(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";
import { loadCityFromDb, getDefaultCitySlug } from "./lib/load-city-from-db";

const TAVILY_KEY = process.env.TAVILY_API_KEY;
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

const BATCH_DELAY_MS = 800;
// Cap: total active highlights × 2 (safety buffer). Web search is expensive; cap prevents runaway.
// Override via MAX_ENRICH_WEB_ITEMS env if needed.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SYSTEM_PROMPT = `You are a local city guide. Search the web for information about the given venue, then produce a JSON object.

Rules:
- short_description: 1-2 sentences, max 250 chars. Capture vibe and what makes it special.
- vibe_tags: 3-6 internal tags (lowercase, underscored). Examples: cozy, date_night, kid_friendly, touristy, local.
- concierge_rationale: One line for "Why this for tonight".
- avg_expected_price: 1-4 if inferable (1=cheap, 2=mid, 3=$$$, 4=$$$$). Use null if unclear.

Return ONLY valid JSON, no markdown:
{"short_description":"...","vibe_tags":["...","..."],"concierge_rationale":"...","avg_expected_price":2}`;

async function tavilySearch(query: string): Promise<string> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TAVILY_KEY}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
    }),
  });
  if (!res.ok) throw new Error(`Tavily: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { results?: Array<{ title?: string; content?: string }> };
  const snippets = (data.results ?? []).map((r) => (r.content ?? r.title ?? "").slice(0, 300)).filter(Boolean);
  return snippets.join("\n\n") || "No search results.";
}

async function callTavilyPlusOpenAI(name: string, city: string, category: string, neighborhood: string | null): Promise<string> {
  const query = `"${name}" ${city} ${neighborhood ? neighborhood + " " : ""}${category} review what is it known for`;
  const searchContext = await tavilySearch(query);
  const prompt = `Web search results for ${name} in ${city}:\n\n${searchContext}\n\nBased on the above, produce a JSON object: short_description (1-2 sentences, 250 chars), vibe_tags (3-6 lowercase underscored), concierge_rationale (one line), avg_expected_price (1-4 or null). Return ONLY valid JSON.`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a Buenos Aires city guide. Return concise JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

async function callPerplexity(name: string, city: string, category: string, neighborhood: string | null): Promise<string> {
  const query = `"${name}" ${city} ${neighborhood ? neighborhood + " " : ""}${category} review what is it known for`;
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PERPLEXITY_KEY}`,
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: query },
      ],
      max_tokens: 400,
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`Perplexity: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

async function callOpenAIKnowledge(name: string, city: string, category: string, neighborhood: string | null): Promise<string> {
  const prompt = `Based on your knowledge of "${name}" in ${city}${neighborhood ? ` (${neighborhood})` : ""} as a ${category}:
Write a JSON object with short_description (1-2 sentences, 250 chars max), vibe_tags (3-6 lowercase underscored tags), concierge_rationale (one line), avg_expected_price (1-4 or null).
Return ONLY valid JSON, no markdown.`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a Buenos Aires city guide. Return concise JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

function parseOutput(text: string) {
  let cleaned = text.trim();
  const codeBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) cleaned = codeBlock[1].trim();
  else {
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) cleaned = objMatch[0];
  }
  cleaned = cleaned.replace(/\*\*/g, "").replace(/^`+|`+$/g, "");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  }
  return {
    short_description:
      typeof parsed.short_description === "string" && parsed.short_description.trim()
        ? parsed.short_description.trim().slice(0, 250)
        : null,
    vibe_tags: Array.isArray(parsed.vibe_tags)
      ? parsed.vibe_tags.filter((t): t is string => typeof t === "string").slice(0, 6)
      : [],
    concierge_rationale:
      typeof parsed.concierge_rationale === "string" && parsed.concierge_rationale.trim()
        ? parsed.concierge_rationale.trim().slice(0, 250)
        : null,
    avg_expected_price:
      typeof parsed.avg_expected_price === "number" && parsed.avg_expected_price >= 1 && parsed.avg_expected_price <= 4
        ? parsed.avg_expected_price
        : null,
  };
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const citySlug = args[0] ?? (await getDefaultCitySlug(supabase));
  const BACKFILL = process.argv.includes("--backfill");

  if (!PERPLEXITY_KEY && !TAVILY_KEY && !OPENAI_KEY) {
    console.error("❌ Set PERPLEXITY_API_KEY (recommended), or TAVILY_API_KEY+OPENAI_API_KEY, or OPENAI_API_KEY in .env.local");
    process.exit(1);
  }

  const mode = PERPLEXITY_KEY ? "web (Perplexity Sonar)" : TAVILY_KEY && OPENAI_KEY ? "web (Tavily + gpt-4o-mini)" : "knowledge (gpt-4o-mini)";
  console.log(`📡 Mode: ${mode}`);

  const city = await loadCityFromDb(supabase, citySlug);
  if (!city) {
    console.error(`❌ Unknown city: "${citySlug}"`);
    process.exit(1);
  }

  const cityName = city.cityFallbackName ?? city.name;

  const { count: totalActive } = await supabase
    .from("highlights")
    .select("id", { count: "exact", head: true })
    .eq("city", cityName)
    .eq("status", "active");

  const total = totalActive ?? 2000;
  const maxFetch = Math.min(Number(process.env.MAX_ENRICH_WEB_ITEMS) || total * 2, 5000);
  const PAGE_SIZE = 1000;

  const allHighlights: unknown[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    let q = supabase
      .from("highlights")
      .select("id, title, short_description, category, neighborhood, avg_expected_price, venue:venues(id, name, neighborhood, fsq_tips)")
      .eq("city", cityName)
      .eq("status", "active")
      .range(offset, offset + PAGE_SIZE - 1);

    if (!BACKFILL) q = q.is("short_description", null);

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

  // Only process venues with NO fsq_tips — internet fallback for tip-less places.
  // (Tip-rich places: use enrich-venues-ai, which consumes tips.)
  const toEnrich = (highlights ?? []).filter((h) => {
    const v = Array.isArray(h.venue) ? h.venue[0] : h.venue;
    if (!v) return false;
    const tips = (v as { fsq_tips?: unknown }).fsq_tips;
    return !(Array.isArray(tips) && tips.length > 0);
  });

  const batch = toEnrich;
  console.log(
    `\n🌐 AI Enrichment (${mode}): ${city.name}\n   Processing ${batch.length} highlights without FSQ tips (of ${toEnrich.length})\n`
  );

  const startedAt = new Date();
  let done = 0;
  let errors = 0;

  for (const h of batch) {
    const v = Array.isArray(h.venue) ? h.venue[0] : h.venue;
    const ven = v as { name?: string; neighborhood?: string | null } | null;
    const name = ven?.name ?? (h.title as string);
    const neighborhood = ven?.neighborhood ?? (h.neighborhood as string | null);

    try {
      const raw = PERPLEXITY_KEY
        ? await callPerplexity(name, cityName, h.category as string, neighborhood)
        : TAVILY_KEY && OPENAI_KEY
          ? await callTavilyPlusOpenAI(name, cityName, h.category as string, neighborhood)
          : await callOpenAIKnowledge(name, cityName, h.category as string, neighborhood);

      const out = parseOutput(raw);

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (out.short_description) updates.short_description = out.short_description;
      if (out.vibe_tags.length > 0) updates.vibe_tags = out.vibe_tags;
      if (out.concierge_rationale) updates.concierge_rationale = out.concierge_rationale;
      if (out.avg_expected_price != null && h.avg_expected_price == null) {
        updates.avg_expected_price = out.avg_expected_price;
      }

      await supabase.from("highlights").update(updates).eq("id", h.id);
      done++;
      process.stdout.write(`   ✅ ${name}\r`);
    } catch (err) {
      errors++;
      console.error(`\n   ❌ ${name}: ${(err as Error).message}`);
    }

    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }

  const finishedAt = new Date();
  const modeKey = PERPLEXITY_KEY ? "perplexity" : TAVILY_KEY && OPENAI_KEY ? "tavily+openai" : "openai";
  await supabase.from("pipeline_runs").insert({
    script: "enrich-venues-ai-web",
    city_slug: citySlug,
    status: "success",
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    items_processed: done,
    run_metadata: { ai_calls: done, mode: modeKey },
  });

  console.log(`\n\n✨ Done! Enriched ${done} highlights${errors > 0 ? `, ${errors} errors` : ""}.`);
  console.log(`   📊 Mode: ${modeKey}. Cost: manual from Perplexity/OpenAI dashboard (no API for Perplexity).`);
}

main().catch(console.error);

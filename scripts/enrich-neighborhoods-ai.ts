/**
 * AI neighborhood guides — generate descriptions for city_neighborhoods
 * based on venue context (names, categories, vibe_tags, price band, counts).
 *
 * **Run after place enrichment** so vibe_tags from enrich-venues-ai can inform the description.
 * All reads from DB; batch only. No runtime AI.
 *
 * Length:
 * - Normal/high-interest (≥5 highlights): ~150–250 words, themes + "what it's known for"
 * - Low-traffic (<5 highlights): shorter 2–3 sentence snippet
 *
 * Usage:
 *   npm run enrich:neighborhoods:ai [city-slug]
 *   npm run enrich:neighborhoods:ai buenos-aires -- --backfill
 *
 * Requires: OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local
 * Requires: migration 040 (city_neighborhoods.description).
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { loadCityFromDb, getDefaultCitySlug } from "./lib/load-city-from-db";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const BATCH_DELAY_MS = 300;
const LOW_TRAFFIC_HIGHLIGHT_THRESHOLD = 5;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatPriceBand(p: number | null): string {
  if (p == null) return "";
  const labels: Record<number, string> = { 1: "budget", 2: "mid", 3: "upscale", 4: "splurge" };
  return labels[p] ?? "";
}

interface NeighborhoodInput {
  name: string;
  city: string;
  sampleVenues: Array<{ name: string; category: string; vibe_tags: string[]; price_band: string }>;
  categoryCounts: Array<{ category: string; count: number }>;
  useLongFormat: boolean;
}

function buildUserPrompt(input: NeighborhoodInput): string {
  const venueLines =
    input.sampleVenues.length > 0
      ? input.sampleVenues
          .map((v) => {
            const tags =
              Array.isArray(v.vibe_tags) && v.vibe_tags.length > 0
                ? ` [${v.vibe_tags.join(", ")}]`
                : "";
            const price = v.price_band ? ` [${v.price_band}]` : "";
            return `- ${v.name} (${v.category})${price}${tags}`;
          })
          .join("\n")
      : "No venue sample available.";

  const countLines =
    input.categoryCounts.length > 0
      ? input.categoryCounts
          .map((c) => `- ${c.category}: ${c.count}`)
          .join("\n")
      : "No category breakdown.";

  if (input.useLongFormat) {
    return `Neighborhood: ${input.name}, ${input.city}

Category counts (venues in this area):
${countLines}

Representative venues (name, category, price band [budget|mid|upscale|splurge], vibe tags):
${venueLines}

Write a brief guide (around 150–250 words) that:
- Captures the neighborhood's vibe and who it's for (e.g. "Popular with young professionals," "Great for date night")
- Highlights 1–2 key characteristics (e.g. "residential & quiet," "bar-heavy," "great cafés for remote work")
- Mentions themes and what the area is known for, based on the venues above
- Avoids raw numbers unless they clearly support the narrative
- Is useful for someone deciding where to explore

Return ONLY the description text, no JSON, no quotes, no preamble.`;
  }

  return `Neighborhood: ${input.name}, ${input.city}

Category counts:
${countLines}

Sample venues:
${venueLines}

Write a short 2–3 sentence micro-guide (max 350 chars). Capture vibe and who it's for. Return ONLY the text, no preamble.`;
}

async function callLLM(input: NeighborhoodInput): Promise<string> {
  const systemPrompt = input.useLongFormat
    ? `You are a local city guide. Write neighborhood guides that capture vibe, themes, and who the area is for. Be evocative and useful. Return only the requested text.`
    : `You are a local city guide. Write concise neighborhood micro-guides. Max 350 chars. Return only the text.`;

  const userPrompt = buildUserPrompt(input);

  const maxChars = input.useLongFormat ? 2000 : 350; // ~250 words ≈ 1500 chars, allow buffer
  const maxTokens = input.useLongFormat ? 600 : 256;

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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    return text.slice(0, maxChars);
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
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const text = data.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
    return text.slice(0, maxChars);
  }

  throw new Error("Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local");
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

  const { data: neighborhoods, error: neighErr } = await supabase
    .from("city_neighborhoods")
    .select("id, name, description")
    .eq("city_id", city.dbId)
    .order("name");

  if (neighErr) {
    console.error("❌ Failed to load neighborhoods:", neighErr.message);
    process.exit(1);
  }

  const toEnrich = (neighborhoods ?? []).filter((n) =>
    BACKFILL ? true : !(n.description && (n.description as string).trim())
  );

  console.log(
    `\n🏘️ Neighborhood guides: ${city.name}\n   Processing ${toEnrich.length} neighborhoods (long format: ≥${LOW_TRAFFIC_HIGHLIGHT_THRESHOLD} highlights)\n`
  );

  let done = 0;
  let errors = 0;

  for (const n of toEnrich) {
    const { data: highlights } = await supabase
      .from("highlights")
      .select("title, category, vibe_tags, avg_expected_price")
      .eq("city", cityName)
      .eq("neighborhood", n.name)
      .eq("status", "active");

    const list = highlights ?? [];
    const totalCount = list.length;
    const useLongFormat = totalCount >= LOW_TRAFFIC_HIGHLIGHT_THRESHOLD;

    // Category counts (e.g. 15 cafés, 6 bars)
    const categoryCounts = new Map<string, number>();
    for (const h of list) {
      const cat = (h.category as string) || "other";
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    }
    const categoryCountsArr = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    // Representative sample: up to 8 with name, category, vibe_tags, price band
    const sampleVenues = list.slice(0, 8).map((h) => ({
      name: h.title as string,
      category: h.category as string,
      vibe_tags: Array.isArray(h.vibe_tags) ? (h.vibe_tags as string[]) : [],
      price_band: formatPriceBand(h.avg_expected_price as number | null),
    }));

    try {
      const description = await callLLM({
        name: n.name,
        city: cityName,
        sampleVenues,
        categoryCounts: categoryCountsArr,
        useLongFormat,
      });

      if (description.trim()) {
        await supabase
          .from("city_neighborhoods")
          .update({ description: description.trim() })
          .eq("id", n.id);
        done++;
        const mode = useLongFormat ? "long" : "short";
        process.stdout.write(`   ✅ ${n.name} (${mode})\r`);
      }
    } catch (err) {
      errors++;
      console.error(`\n   ❌ ${n.name}: ${(err as Error).message}`);
    }

    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }

  console.log(`\n\n✨ Done! Enriched ${done} neighborhoods${errors > 0 ? `, ${errors} errors` : ""}.`);
}

main().catch(console.error);

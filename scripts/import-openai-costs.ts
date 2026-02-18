/**
 * Import OpenAI costs from the Costs API into api_costs.
 * Requires an OpenAI Admin key (Settings → Organization → Admin keys).
 *
 * Usage:
 *   npm run import:openai-costs
 *   npm run import:openai-costs -- --days 30
 *
 * Env: OPENAI_API_KEY or OPENAI_ADMIN_API_KEY (Admin key required for /organization/costs)
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const OPENAI_KEY = process.env.OPENAI_ADMIN_API_KEY ?? process.env.OPENAI_API_KEY;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_DAYS = 30;

/** GPT-4o-mini pricing per 1M tokens (USD) — fallback when Costs API lacks dollar amounts */
const GPT4O_MINI_INPUT_PER_M = 0.15;
const GPT4O_MINI_OUTPUT_PER_M = 0.6;

function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * GPT4O_MINI_INPUT_PER_M +
    (outputTokens / 1_000_000) * GPT4O_MINI_OUTPUT_PER_M
  );
}

async function main() {
  if (!OPENAI_KEY) {
    console.error("❌ Set OPENAI_ADMIN_API_KEY or OPENAI_API_KEY in .env.local");
    console.error("   Admin key required: https://platform.openai.com/settings/organization/admin-keys");
    process.exit(1);
  }

  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const daysArg = process.argv.find((a) => a.startsWith("--days="));
  const days = daysArg ? parseInt(daysArg.split("=")[1] ?? "", 10) : DEFAULT_DAYS;
  const validDays = Number.isFinite(days) && days >= 1 && days <= 180 ? days : DEFAULT_DAYS;

  const endTime = Math.floor(Date.now() / 1000);
  const startTime = endTime - validDays * 24 * 60 * 60;

  console.log(`\n📊 Importing OpenAI costs (last ${validDays} days)\n`);

  const allData: { start_time: number; end_time: number; cost_usd?: number; input_tokens?: number; output_tokens?: number }[] = [];
  let page: string | null = null;

  do {
    const url = new URL("https://api.openai.com/v1/organization/costs");
    url.searchParams.set("start_time", String(startTime));
    url.searchParams.set("end_time", String(endTime));
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "30");
    if (page) url.searchParams.set("page", page);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 403 || res.status === 401) {
        console.error("❌ OpenAI Costs API requires an Admin key. Create one at:");
        console.error("   https://platform.openai.com/settings/organization/admin-keys");
      }
      console.error(`   ${res.status}: ${text}`);
      process.exit(1);
    }

    const data = await res.json();
    const buckets = data.data ?? [];
    page = data.next_page ?? null;

    for (const bucket of buckets) {
      const start = bucket.start_time ?? 0;
      const end = bucket.end_time ?? 0;
      const results = bucket.result ?? bucket.results ?? [];
      let costUsd: number | undefined;
      let inputTokens = 0;
      let outputTokens = 0;

      for (const r of results) {
        const amt = r.amount;
        if (amt && typeof amt.value === "number") {
          costUsd = (costUsd ?? 0) + amt.value;
        }
        inputTokens += r.input_tokens ?? 0;
        outputTokens += r.output_tokens ?? 0;
      }

      if (costUsd == null && (inputTokens > 0 || outputTokens > 0)) {
        costUsd = estimateCost(inputTokens, outputTokens);
      }
      if (costUsd != null && costUsd > 0) {
        allData.push({
          start_time: start,
          end_time: end,
          cost_usd: costUsd,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        });
      }
    }
  } while (page);

  if (allData.length === 0) {
    console.log("   Costs API returned no data. Trying Usage API (token-based estimate)...");
    const usageRes = await fetch(
      `https://api.openai.com/v1/organization/usage/completions?start_time=${startTime}&end_time=${endTime}&bucket_width=1d&limit=30`,
      {
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (usageRes.ok) {
      const usageJson = await usageRes.json();
      const usageBuckets = usageJson.data ?? [];
      for (const bucket of usageBuckets) {
        const start = bucket.start_time ?? 0;
        let inputTokens = 0;
        let outputTokens = 0;
        for (const r of bucket.results ?? []) {
          inputTokens += r.input_tokens ?? 0;
          outputTokens += r.output_tokens ?? 0;
        }
        if (inputTokens > 0 || outputTokens > 0) {
          allData.push({
            start_time: start,
            end_time: bucket.end_time ?? 0,
            cost_usd: estimateCost(inputTokens, outputTokens),
            input_tokens: inputTokens,
            output_tokens: outputTokens,
          });
        }
      }
    }
  }

  if (allData.length === 0) {
    console.log("   No cost or usage data in the requested range.");
    return;
  }

  let inserted = 0;
  for (const row of allData) {
    const costDate = new Date(row.start_time * 1000).toISOString().slice(0, 10);
    const { error } = await supabase.from("api_costs").upsert(
      {
        provider: "openai",
        cost_date: costDate,
        cost_usd: row.cost_usd ?? 0,
        raw_data: {
          input_tokens: row.input_tokens,
          output_tokens: row.output_tokens,
        },
      },
      { onConflict: "provider,cost_date" }
    );
    if (!error) inserted++;
  }

  console.log(`   Imported ${inserted} days → api_costs. View in Admin → Usage.\n`);
}

main().catch(console.error);

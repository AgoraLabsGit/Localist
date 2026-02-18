/**
 * Record manual API costs (Perplexity, Google, Foursquare) into api_costs.
 * OpenAI costs use import:openai-costs (auto). Use this for providers with no API.
 *
 * Usage:
 *   npm run record:api-cost -- perplexity 2025-02-20 0.25
 *   npm run record:api-cost -- google 2025-02-20 0.26
 *
 * Args: provider date cost_usd
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_PROVIDERS = ["perplexity", "google", "foursquare"];

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const [provider, dateStr, costStr] = args;

  if (!provider || !dateStr || !costStr) {
    console.log("\nUsage: npm run record:api-cost -- <provider> <date> <cost_usd>");
    console.log("  provider: perplexity | google | foursquare");
    console.log("  date: YYYY-MM-DD");
    console.log("  cost_usd: e.g. 0.25\n");
    console.log("Example: npm run record:api-cost -- perplexity 2025-02-20 0.25\n");
    process.exit(1);
  }

  const p = provider.toLowerCase();
  if (!VALID_PROVIDERS.includes(p)) {
    console.error(`❌ Provider must be one of: ${VALID_PROVIDERS.join(", ")}`);
    process.exit(1);
  }

  const cost = parseFloat(costStr);
  if (!Number.isFinite(cost) || cost < 0) {
    console.error("❌ cost_usd must be a non-negative number");
    process.exit(1);
  }

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    console.error("❌ date must be YYYY-MM-DD");
    process.exit(1);
  }

  const { error } = await supabase.from("api_costs").upsert(
    {
      provider: p,
      cost_date: dateStr,
      cost_usd: cost,
      raw_data: { source: "manual", recorded_via: "record-api-cost" },
    },
    { onConflict: "provider,cost_date" }
  );

  if (error) {
    console.error("❌", error.message);
    process.exit(1);
  }

  console.log(`\n✅ Recorded ${p} $${cost.toFixed(4)} for ${dateStr} → api_costs. View in Admin → Usage.\n`);
}

main().catch(console.error);

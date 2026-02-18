# Cost Log — API Dashboard to Ingestion Run Tracking

Track costs from API dashboards and correlate them with ingestion/enrichment runs to refine backend and AI cost estimates.

**Related:** [COSTS](COSTS.md), [DATA-PIPELINE](DATA-PIPELINE.md), [AI-PIPELINE](AI-PIPELINE.md).

---

## Where to Record Costs

| API | Dashboard | What to Record |
|-----|-----------|----------------|
| **Google** | [Google Cloud Console → Billing](https://console.cloud.google.com/billing) | Places API (Text Search, Place Details), Geocoding API — costs by day |
| **Foursquare** | [Foursquare Developer Dashboard](https://foursquare.com/developers/dashboard) | API usage / credits consumed — often by month |
| **OpenAI** | [OpenAI Usage](https://platform.openai.com/usage) | Input/output tokens, cost by model (gpt-4o-mini) — by day |
| **Anthropic** | [Anthropic Console → Usage](https://console.anthropic.com/) | Token usage, cost — by day |
| **Perplexity** | [API Billing](https://www.perplexity.ai/account/api/billing) | Credits/usage for enrich-venues-ai-web (Sonar) — by day |

**Tip:** For best correlation, run one pipeline at a time and record immediately. If multiple runs happen in one billing day, costs are aggregated — estimate by run using API call counts printed at the end of each script.

---

## Listing Recent Runs

Ingestion runs are stored in `ingestion_jobs`. Other scripts (fetch-tips, enrich-ai) do not write there yet — record by script name and timestamp.

### SQL: Recent ingestion jobs

```sql
SELECT id, source, status, started_at, finished_at, items_fetched, items_successful, run_metadata
FROM ingestion_jobs
ORDER BY finished_at DESC
LIMIT 30;
```

`run_metadata` (if present) includes `google_calls`, `fsq_calls`, `city_slug` for cost estimation.

**Admin UI:** View runs and costs at **Admin → Usage**. Run migrations 042–044: `supabase db push` or `npm run db:migrate`. OpenAI: `npm run import:openai-costs`. Perplexity/Google/FSQ (manual): `npm run record:api-cost -- perplexity 2025-02-20 0.25`.

---

## Programmatic Cost APIs

| Provider | Automated? | How |
|----------|------------|-----|
| **OpenAI** | ✅ Yes | `npm run import:openai-costs` — fetches Costs API (or Usage API fallback), stores in `api_costs`. Requires Admin key: [Settings → Admin keys](https://platform.openai.com/settings/organization/admin-keys). Set `OPENAI_ADMIN_API_KEY` or `OPENAI_API_KEY` in `.env.local`. |
| **Anthropic** | ⚠️ API exists | [Usage & Cost API](https://docs.anthropic.com/en/api/usage-cost-api) — requires Admin key. No import script yet. |
| **Google Cloud** | ❌ No simple API | [Billing export to BigQuery](https://cloud.google.com/billing/docs/how-to/export-data-bigquery) only. Requires GCP setup, BigQuery, enable export. No direct REST cost API. |
| **Foursquare** | ❌ No API | Dashboard only. [CSV export](https://foursquare.com/developer/docs/view-api-usage) for monthly usage; no programmatic cost/usage API. |
| **Perplexity** | ❌ No API | Dashboard only. [API billing](https://www.perplexity.ai/account/api/billing) — Sonar ~$1/1M tokens + search fees. enrich-venues-ai-web logs to pipeline_runs (Admin → Usage) when using Perplexity; cost = manual from dashboard. |

---

## Cost Log Template

Append rows as you run pipelines and check dashboards. Use your preferred format (CSV, Notion, etc.); this table is a reference.

| Date | Script | City | Run ID / Notes | Items | Google $ | FSQ $ | OpenAI $ | Perplexity $ | Total $ | Notes |
|------|--------|------|----------------|-------|----------|-------|----------|--------------|---------|-------|
| 2025-02-18 | ingest-places-typed | buenos-aires | uuid / incremental | 450 | 0.26 | 2.50 | — | — | 2.76 | — |
| 2025-02-18 | fetch-venue-tips | buenos-aires | — | 150 venues | — | 0.80 | — | — | 0.80 | — |
| 2025-02-19 | enrich-venues-ai | buenos-aires | — | 120 highlights | — | — | 0.02 | — | 0.02 | GPT-4o-mini |
| 2025-02-20 | enrich-venues-ai-web | buenos-aires | — | 45 highlights | — | — | — | 0.25 | 0.25 | Perplexity Sonar |

---

## Cost Log Entries

*(Add rows below as you record runs)*


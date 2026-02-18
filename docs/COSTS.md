# Costs

**Cost tracking:** Record API dashboard costs and match to runs via [COST-LOG](COST-LOG.md). Scripts print API call counts at the end of each run.

---

## Revenue (per paid user)

$5/mo gross → ~$4.55 net (Stripe).

---

## API Costs

### Google Places

| Use | Cost |
|-----|------|
| Text Search (ingest, 8/city) | ~$0.26/city/run |
| Place Details | ~$17/1K; $200/mo credit available |

### Foursquare

- ~18.75 credits/call ≈ $0.01875/call
- **New city:** ~300–400 calls (ingest + photos + descriptions) ≈ $5–7

**Reduce usage:** `--incremental` on ingest; skip `--refresh` on photos; run `update-descriptions` once. Set caps in Admin → Settings (default 200 FSQ/run).

### AI (Phase 2)

- **GPT-4o-mini** (enrich-venues-ai, tip-rich places): ~$0.0001/place; ~$0.15/1M input, ~$0.60/1M output tokens
- **Claude Haiku**: ~$0.0008/place
- **Perplexity Sonar** (enrich-venues-ai-web, no-tip places): ~$1/1M tokens + search fees (~$0.005/search). Web-sourced enrichment for venues without FSQ tips.

---

## MVP (1 city, <1K users)

~$2/mo ongoing. +$5–7 one-time for first city ingest.

---

## Break-even

~11–18 paid subs to cover Pro stack + variable costs.

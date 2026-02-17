# Costs

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

- GPT-4o-mini: ~$0.0001/place
- Claude Haiku: ~$0.0008/place

---

## MVP (1 city, <1K users)

~$2/mo ongoing. +$5–7 one-time for first city ingest.

---

## Break-even

~11–18 paid subs to cover Pro stack + variable costs.

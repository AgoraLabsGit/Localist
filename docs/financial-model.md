# Localist — Financial Model

*$5/month subscription. DB-first architecture. Full cost breakdown.*

---

## Revenue (per paid user)

| Item | Amount |
|------|--------|
| Gross | $5.00 |
| Stripe (2.9% + $0.30) | -$0.45 |
| **Net** | **$4.55** |

---

## Cost Components

### 1. Google Places API

*Reference: [Places API Billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing). ~$200/mo free credit (verify current policy).*

| SKU | Price per 1,000 | Our usage |
|-----|------------------|-----------|
| Text Search (Pro) | ~$32 | Ingestion: discover places |
| Place Details (Pro) | ~$17 | Display: rating, hours, address per detail view |

**Ingestion pipeline (per city, per run):**
- 8 categories × 1 Text Search each = 8 calls
- ~160 places returned total
- **Cost:** 8 × $0.032 ≈ **$0.26 per city per run**

**Optional: Place Details during ingestion (for AI context):**
- If we call Place Details to enrich each place before AI: 160 calls × $0.017 ≈ **$2.72 per city per run**
- Alternative: Use Text Search response only (name, address, rating) → $0 extra

**Detail view (user opens place):**
- 1 Place Details call per view (unless cached)
- With 24h cache per place_id: cost = unique places viewed × 30 days
- Example: 200 hot places × 30 = 6K calls ≈ **$102/mo** (or covered by $200 credit)

**Example monthly ingestion (10 cities, 2 runs):**
- Text Search only: 10 × 2 × 8 = 160 calls ≈ **$5**
- + Place Details for AI: 10 × 2 × 160 = 3,200 calls ≈ **$54** (if we fetch details for AI input)

---

### 2. AI (Claude / GPT for place cards)

*Transform Google API output → our unique descriptions + vibe_tags for Supabase.*

**Reference:** Claude Haiku ~$1/MTok input, $5/MTok output. GPT-4o-mini ~$0.15/MTok in, $0.60/MTok out.

**Per place:**
- Input: name, category, neighborhood, address, rating (from Text Search or Place Details) ≈ 150–250 tokens
- Output: 2–3 sentence description + 3–5 vibe tags ≈ 100–150 tokens
- **Claude Haiku:** 200 in × $0.001 + 125 out × $0.005 ≈ **$0.0008/place**
- **GPT-4o-mini:** ≈ **$0.0001/place** (cheaper)

**At scale:**

| Places | Claude Haiku | GPT-4o-mini |
|--------|--------------|-------------|
| 1K (1 city) | ~$0.80 | ~$0.10 |
| 10K (10 cities) | ~$8 | ~$1 |
| 100K (50 cities) | ~$80 | ~$10 |

**Ongoing refresh:** If we regenerate 10% of places monthly: 10K places × 10% = 1K calls ≈ **$0.80/mo** (Haiku) or **$0.10/mo** (GPT-4o-mini).

---

### 3. Database (Supabase)

| Tier | Monthly | DB storage | Auth users |
|------|---------|------------|------------|
| Free | $0 | 500 MB | 50K |
| Pro | $25 | 8 GB | 100K |
| Team | $599 | Custom | Custom |

**Storage estimate:**
- Highlight row: ~500 B. Venue: ~400 B. User + saved_items: ~200 B.
- 100K places: highlights + venues ≈ 90 MB
- 10K users + saved_items ≈ 20 MB
- **100K places + 10K users ≈ 150 MB** → Free tier
- **1M places + 100K users** → likely need Pro ($25) or more

**Overage:** Pro includes 8 GB. Beyond that: ~$0.125/GB/mo (gp3 disk).

---

### 4. Hosting (Vercel)

| Tier | Monthly | Bandwidth | Functions |
|------|---------|-----------|-----------|
| Hobby | $0 | 100 GB | 100K invocations |
| Pro | $20 | 1 TB | 1M invocations |

**At 1K MAU:** Usually within Hobby. Pro for team features (preview URLs, etc.).

---

### 5. Other

| Item | Cost |
|------|------|
| Domain | ~$12/year ≈ $1/mo |
| Upstash Redis (cache) | Free tier: 10K commands/day. Pro $0.20/100K |
| Email (auth, digest) | Resend free: 3K/mo. Paid if scale |
| Stripe | Per transaction (included in revenue calc above) |

---

## Full Cost Model by Stage

### Stage 1: MVP (1 city, ~150 places, &lt;1K users)

| Cost | Amount |
|------|--------|
| Google Text Search (2 runs/mo) | ~$1 |
| Google Place Details (detail view, cached) | $0 (within $200 credit) |
| AI (templates only) | $0 |
| Supabase Free | $0 |
| Vercel Hobby | $0 |
| Domain | $1 |
| **Total** | **~$2/mo** |

---

### Stage 2: 5 cities, AI descriptions, 5K users, 100 paid

| Cost | Amount |
|------|--------|
| Google Text Search (5 × 2 × 8 = 80) | ~$3 |
| Google Place Details (ingestion for AI, optional) | $0 or ~$27 |
| Google Place Details (detail view, 300 places × 30) | ~$153 (or $0 if cached) |
| AI (5 × 160 × 2 runs ≈ 1.6K places, Haiku) | ~$1.30 |
| Supabase Pro | $25 |
| Vercel Pro | $20 |
| Domain + misc | $2 |
| **Total** | **~$55** (no Place Details in ingest) or **~$230** (full pipeline) |
| **Revenue (100 paid)** | $455 |
| **Profit** | **~$225** (conservative) to **~$400** (optimistic) |

---

### Stage 3: 20 cities, 20K places, 20K users, 500 paid

| Cost | Amount |
|------|--------|
| Google Text Search (20 × 2 × 8) | ~$10 |
| Google Place Details (detail, cached 500 × 30) | ~$255 or credit |
| AI (4K new places/run × 2, Haiku) | ~$6 |
| Supabase Pro | $25 |
| Vercel Pro | $20 |
| Domain + misc | $2 |
| **Total** | **~$60** (best case) to **~$320** (uncached) |
| **Revenue (500 paid)** | $2,275 |
| **Profit** | **~$1,950** to **~$2,215** |

---

## Summary Table: Profit at Scale

*Assumes: Place Details cached 24h; AI = Claude Haiku; Supabase + Vercel Pro.*

| Paid subs | Revenue (net) | Infra (est.) | **Profit** | Margin |
|-----------|---------------|--------------|-----------|--------|
| 50 | $228 | $50 | **$178** | 78% |
| 100 | $455 | $80 | **$375** | 82% |
| 500 | $2,275 | $150 | **$2,125** | 93% |
| 1,000 | $4,550 | $250 | **$4,300** | 95% |
| 5,000 | $22,750 | $600 | **$22,150** | 97% |

*Infra includes: DB, hosting, Google (ingestion + cached detail), AI.*

---

## Cost Levers

1. **Cache Place Details** — Biggest lever. Without cache, cost scales with page views.
2. **Skip Place Details in ingestion** — Use Text Search response for AI input. Saves ~$50+/mo at 5 cities.
3. **Use GPT-4o-mini for AI** — ~10× cheaper than Haiku. Descriptions still good.
4. **Use templates (no AI)** — $0. Slightly less differentiated.
5. **Stay on Supabase/Vercel free** — Until ~10K users or 100K places.

---

## Break-Even

- **Fixed (Pro stack + domain):** ~$48/mo → **~11 paid subs**
- **With variable (Google + AI):** ~$80/mo → **~18 paid subs**

# Foursquare Places API Setup

Localist uses Foursquare for **address, hours, phone, website, and rating**. You need a **Service API Key** — OAuth is not required for server-side ingest.

---

## 1. Create a Project (if you don’t have one)

1. Go to [foursquare.com/developers/signup](https://foursquare.com/developers/signup)
2. Sign up or log in
3. Click **Create New Project** and give it a name (e.g. "Localist")

---

## 2. Generate a Service API Key

**Important:** Use a **Service API Key**, not a legacy API key. The new Places API does not use OAuth or client ID/secret.

1. Open your project in the [Foursquare Developer Console](https://foursquare.com/developers)
2. Go to **Project Settings** (gear icon) or **Settings**
3. Find the **Service API Keys** section
4. Click **Generate Service API Key**
5. Enter a name (e.g. "Localist Ingest") and click **Next**
6. **Copy the key immediately** — you can only see it once
7. Click **Dismiss**

---

## 3. Add to Your Environment

In `.env.local`:

```
FOURSQUARE_API_KEY=your_service_api_key_here
```

Our code uses `Authorization: Bearer <key>` as required by the new Places API.

---

## 4. Credits / Billing

- **10,000 Places Pro calls/month** are free
- For more, configure billing at [foursquare.com/developers/orgs](https://foursquare.com/developers/orgs)
- If you get **429 (no credits)**, add credits or enable Auto Recharge

---

## 5. Troubleshooting

| Symptom | Likely Cause |
|---------|---------------|
| **0 API calls in dashboard** | Wrong key type (legacy API key instead of Service Key), or 401 so requests never count |
| **401 Unauthorized** | Invalid key or using a legacy key. Generate a new **Service API Key** in Project Settings |
| **429 Too Many Requests** | No credits. Add credits at [foursquare.com/developers/orgs](https://foursquare.com/developers/orgs) |

---

## 6. Authentication Methods (Reference)

| Method | Use Case | Needed for Localist? |
|--------|----------|----------------------|
| **Service Keys** | Server scripts, background jobs, internal tools | ✅ **Yes** |
| **Managed Users** | Per-user attribution without Foursquare accounts | No |
| **OAuth (3rd Party)** | When users connect their Foursquare accounts | No |

Localist uses **Service Keys** only. No OAuth, no client ID/secret.

# Language Upgrade — Spanish / i18n Foundation

**Status: Implemented** (Phase 1–4). Uses `next-intl` with cookie-based locale.

Exploration doc for adding Spanish and an i18n foundation to Localist.

## Approach

**Library:** `next-intl` (MIT, no cost)

**Strategy:** Cookie-based locale (no `/es/` in URLs). Locale determined by:
1. **Cookie** `locale` — when set (user choice or persisted detection)
2. **Accept-Language header** — when no cookie (first visit; works on desktop and mobile)
3. **`users.language`** — persisted on signup/login, syncs to cookie

On first visit with no cookie, the server detects from `Accept-Language`; `LocaleDetector` persists it to the cookie so Settings and future requests stay in sync.

**Where to select:** Onboarding (step 0 or early) + Settings (Appearance section).

---

## Implementation Plan

### Phase 1: Foundation (~1 day)

1. **Install next-intl**
   ```bash
   npm install next-intl
   ```

2. **Create `src/i18n/request.ts`**
   - Read locale from `locale` cookie (default `en`)
   - Load messages: `messages/${locale}.json`
   - No locale in URL path (`localePrefix: 'never'` or equivalent)

3. **Create `next.config.js`** (or update existing)
   - Wrap app with `createNextIntlPlugin` if needed
   - Or use `NextIntlClientProvider` in layout

4. **Message files**
   - `messages/en.json` — English
   - `messages/es.json` — Spanish

5. **Layout wiring**
   - Add `NextIntlClientProvider` in root layout
   - Point `next-intl` at `getRequestConfig` from `i18n/request.ts`

### Phase 2: Extract strings (incremental)

**High-value, high-traffic areas first:**
- Onboarding flow (`onboarding-flow.tsx`) — ~100+ strings in option arrays
- Settings page + sections
- Home page, tab nav, filter sheet
- Auth pages (login, signup, forgot-password)

**Pattern:** Replace `"I live here"` with `t("onboarding.persona.local")`.

**Option structure for onboarding:**
```json
{
  "onboarding": {
    "persona": {
      "local": "I live here",
      "nomad": "I'm here long-term (1–6 months)",
      "tourist": "I'm visiting for a trip"
    },
    "weeklyOutings": { "1": "0–1 a week", "2": "2–3 a week", ... }
  }
}
```

### Phase 3: Language selection UI

1. **Onboarding**
   - Add step 0 or insert at start of step 1: "Language / Idioma" with EN / ES toggle
   - Save to `users.language` on completion (or create user with language)

2. **Settings**
   - Add "Language" section (with ThemeSection)
   - Dropdown or toggle: English | Español
   - On change: set cookie + call API to update `users.language`

### Phase 4: Sync user.language

- On login/signup: read `users.language`, set `locale` cookie
- API route `PATCH /api/user/language` to update `users.language`
- Language picker in settings calls this API and sets cookie

---

## Existing DB Support

- `users.language TEXT DEFAULT 'en'` — already in schema (from `001_initial_schema.sql`)

---

## Cookie + Server Sync

```ts
// i18n/request.ts
const store = await cookies();
const locale = store.get('locale')?.value || 'en';
// Optional: if user is logged in, prefer users.language over cookie
```

---

## Effort Estimate

| Phase              | Effort   |
|--------------------|----------|
| 1. Foundation      | 0.5–1 d  |
| 2. Extract strings | 2–3 d    |
| 3. Language UI     | 0.5 d    |
| 4. User sync       | 0.5 d    |
| **Total**          | **3–5 d**|

---

## Files to touch (partial list)

| File                          | Changes                                      |
|-------------------------------|-----------------------------------------------|
| `src/app/layout.tsx`          | Wrap with NextIntlClientProvider              |
| `src/i18n/request.ts`         | New — getRequestConfig, cookie locale         |
| `messages/en.json`            | New — English strings                         |
| `messages/es.json`             | New — Spanish strings                         |
| `src/components/onboarding-flow.tsx` | Use `useTranslations`, replace labels  |
| `src/app/settings/page.tsx`   | Add LanguageSection                           |
| `src/app/settings/language-section.tsx` | New — language picker                 |
| `src/app/api/user/language/route.ts` | New — PATCH to update users.language  |
| `next.config.js`              | Add next-intl plugin if required              |

---

## Implemented (Feb 2025)

- **Phase 1:** `next-intl`, `src/i18n/request.ts`, `messages/en.json`, `messages/es.json`
- **Phase 2:** `createNextIntlPlugin`, `NextIntlClientProvider` in layout
- **Phase 3:** `LanguageSection` in Settings, `PATCH /api/user/language`
- **Phase 4:** Auth callback syncs `users.language` → cookie on login; onboarding API saves locale
- **Strings:** Nav tabs, settings headers, theme toggle, search placeholder, Your Places sub-tabs

## Next steps (incremental)

1. Add more strings to onboarding-flow.tsx (persona, time blocks, etc.)
2. Add language step at start of onboarding (optional)
3. **Add Portuguese:** See [I18N-ADD-PORTUGUESE.md](./I18N-ADD-PORTUGUESE.md) for the step-by-step process

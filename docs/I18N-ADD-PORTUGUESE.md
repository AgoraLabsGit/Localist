# Add Portuguese — Step-by-Step Process

Use this checklist when adding Portuguese (or any new language) to Localist. The i18n foundation is already in place.

## Prerequisites

- `next-intl` installed
- `src/i18n/request.ts` and `src/i18n/locales.ts` exist
- `messages/en.json` and `messages/es.json` exist

---

## Step 1: Add locale to config

**File:** `src/i18n/request.ts`

```ts
const SUPPORTED = ["en", "es", "pt"] as const;  // add "pt"
```

**File:** `src/i18n/locales.ts`

```ts
export const locales = ["en", "es", "pt"] as const;  // add "pt"
```

---

## Step 2: Create message file

**File:** `messages/pt.json`

1. Copy `messages/en.json` as the base
2. Translate all values to Portuguese (keep keys identical)
3. For Brazilian Portuguese, prefer "pt-BR" style if needed (e.g. "você" vs "tu")
4. Use `pt` as the locale code (or `pt-BR` if you want regional distinction)

---

## Step 3: Add to language picker

**File:** `src/components/language-picker.tsx`

```ts
const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  pt: "Português",  // add
};
```

The picker reads `locales` from `@/i18n/locales`, so it will auto-include "pt" once added there.

---

## Step 4: Update API and auth

**File:** `src/app/api/user/language/route.ts`

```ts
if (!locale || !["en", "es", "pt"].includes(locale)) {  // add "pt"
```

**File:** `src/app/auth/callback/route.ts`

```ts
const lang = locale && ["en", "es", "pt"].includes(locale) ? locale : "en";  // add "pt"
```

---

## Step 5: Validation

1. Run `npm run dev`
2. Go to Settings → Language
3. Select "Português"
4. Navigate through: home, explore, filters, Concierge, My Places, settings
5. Spot-check for any untranslated strings (will show English fallback)
6. Add any missing keys to `pt.json` and re-test

---

## Files to touch (summary)

| File | Change |
|------|--------|
| `src/i18n/request.ts` | Add `"pt"` to SUPPORTED |
| `src/i18n/locales.ts` | Add `"pt"` to locales |
| `messages/pt.json` | New file — copy en.json, translate |
| `src/components/language-picker.tsx` | Add `pt: "Português"` to LOCALE_LABELS |
| `src/app/api/user/language/route.ts` | Add `"pt"` to validation |
| `src/app/auth/callback/route.ts` | Add `"pt"` to validation |

---

## Translation tips

1. **Copy structure:** Ensure `pt.json` has the exact same key structure as `en.json`
2. **ICU placeholders:** Keep `{count}`, `{time}`, `{city}` etc. — only translate surrounding text
3. **Buenos Aires context:** Some copy assumes BA; adapt if needed for pt (e.g. "barrios" can stay)
4. **AI assist:** Use GPT/Claude to draft translations from en.json; human-review for tone

---

## Rollback

If something breaks, remove `"pt"` from:
- `src/i18n/request.ts`
- `src/i18n/locales.ts`
- `src/app/api/user/language/route.ts`
- `src/app/auth/callback/route.ts`
- `src/components/language-picker.tsx` (LOCALE_LABELS)
- Delete `messages/pt.json`

Users who had selected pt will fall back to `en` on next load.

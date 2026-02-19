import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

const SUPPORTED = ["en", "es", "pt"] as const;
type Locale = (typeof SUPPORTED)[number];

/** Match Accept-Language header to a supported locale. e.g. "es-AR,es;q=0.9,en;q=0.8" → "es" */
function matchAcceptLanguage(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return "en";
  const parts = acceptLanguage.split(",").map((p) => p.trim().split(";")[0]);
  for (const part of parts) {
    const lang = part?.split("-")[0]?.toLowerCase();
    if (lang === "es") return "es";
    if (lang === "pt") return "pt";
    if (lang === "en") return "en";
  }
  return "en";
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get("locale")?.value;
  let validLocale: Locale = "en";

  if (cookieLocale && SUPPORTED.includes(cookieLocale as Locale)) {
    validLocale = cookieLocale as Locale;
  } else {
    // No cookie: detect from Accept-Language (works on desktop and mobile)
    const headersList = await headers();
    const acceptLanguage = headersList.get("accept-language");
    validLocale = matchAcceptLanguage(acceptLanguage);
  }

  return {
    locale: validLocale,
    messages: (await import(`../../messages/${validLocale}.json`)).default,
  };
});

"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { locales, type Locale } from "@/i18n/locales";

/**
 * On first visit (no locale cookie), persist the server-detected locale
 * (from Accept-Language) to the cookie so Settings picker and future
 * requests stay in sync.
 */
export function LocaleDetector() {
  const locale = useLocale() as string;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const hasCookie = document.cookie.includes("locale=");
    if (hasCookie) return;
    const validLocale: Locale = locales.includes(locale as Locale) ? (locale as Locale) : "en";
    document.cookie = `locale=${validLocale};path=/;max-age=31536000`;
  }, [locale]);

  return null;
}

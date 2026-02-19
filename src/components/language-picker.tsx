"use client";

import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { locales, type Locale } from "@/i18n/locales";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
};

function setLocaleCookie(locale: Locale) {
  document.cookie = `locale=${locale};path=/;max-age=31536000`;
}

export function LanguagePicker() {
  const t = useTranslations("languagePicker");
  const locale = useLocale() as Locale;
  const router = useRouter();

  const handleChange = useCallback(
    async (newLocale: Locale) => {
      setLocaleCookie(newLocale);
      router.refresh();

      try {
        await fetch("/api/user/language", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: newLocale }),
        });
      } catch {
        // Cookie is set; user preference will sync on next login
      }
    },
    [router]
  );

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-foreground">{t("title")}</span>
      <div className="relative min-w-[120px]">
        <select
          className="w-full rounded-[14px] border border-border-app bg-surface-alt pl-4 pr-12 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-tab-indicator/50 appearance-none"
          value={locales.includes(locale) ? locale : "en"}
          onChange={(e) => {
            const v = e.target.value as Locale;
            if (locales.includes(v)) handleChange(v);
          }}
          aria-label={t("title")}
        >
          {locales.map((l) => (
            <option key={l} value={l}>
              {LOCALE_LABELS[l]}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      </div>
    </div>
  );
}

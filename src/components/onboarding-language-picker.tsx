"use client";

import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useState, useRef, useEffect } from "react";
import { Languages } from "lucide-react";
import { locales, type Locale } from "@/i18n/locales";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
};

function setLocaleCookie(locale: Locale) {
  document.cookie = `locale=${locale};path=/;max-age=31536000`;
}

export function OnboardingLanguagePicker() {
  const t = useTranslations("languagePicker");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [open]);

  const handleChange = useCallback(
    async (newLocale: Locale) => {
      setLocaleCookie(newLocale);
      setOpen(false);
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
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-2 -m-2 rounded-full text-muted-foreground hover:text-foreground transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label={t("title")}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Languages className="w-5 h-5" strokeWidth={1.5} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 py-1 min-w-[120px] rounded-[12px] bg-surface border border-border-app shadow-card-soft z-50"
          role="listbox"
        >
          {locales.map((l) => (
            <button
              key={l}
              type="button"
              role="option"
              aria-selected={locale === l}
              onClick={() => handleChange(l)}
              className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                locale === l
                  ? "bg-tab-selected text-tab-selected-fg"
                  : "text-foreground hover:bg-surface-alt"
              }`}
            >
              {LOCALE_LABELS[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

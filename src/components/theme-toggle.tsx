"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const t = useTranslations("theme");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-foreground min-w-[7ch]">
        {mounted ? (isDark ? t("darkMode") : t("lightMode")) : "\u00A0"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={!isDark}
        aria-label={t("toggleLabel", { mode: isDark ? t("darkMode") : t("lightMode") })}
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={`
          relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2
          transition-colors duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-tab-indicator focus:ring-offset-2 focus:ring-offset-surface
          ${isDark 
            ? "border-border-medium bg-surface-elevated" 
            : "border-border-strong bg-tab-indicator/80"}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0
            transition duration-200 ease-in-out
            ${isDark ? "translate-x-1" : "translate-x-7"}
          `}
        />
      </button>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const tabs = ["My Places", "Concierge", "Explore"] as const;
export type Tab = (typeof tabs)[number];

const TAB_KEYS: Record<Tab, "myPlaces" | "concierge" | "explore"> = {
  "My Places": "myPlaces",
  Concierge: "concierge",
  Explore: "explore",
};

interface TabNavProps {
  active: Tab;
  onTabChange: (tab: Tab) => void;
}

export function TabNav({ active, onTabChange }: TabNavProps) {
  const t = useTranslations("nav");

  return (
    <div className="flex w-full border-b border-border-app" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab}
          role="tab"
          aria-selected={active === tab}
          onClick={() => onTabChange(tab)}
          className={cn(
            "flex-1 py-2.5 px-2 text-[16px] font-semibold font-display transition-colors touch-manipulation relative -mb-px",
            active === tab
              ? "text-foreground"
              : "text-muted-foreground border-transparent hover:text-foreground"
          )}
        >
          {t(TAB_KEYS[tab])}
          {active === tab && (
            <span
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[110%] h-[2px] bg-tab-indicator rounded-full"
              aria-hidden
            />
          )}
        </button>
      ))}
    </div>
  );
}

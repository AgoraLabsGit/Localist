"use client";

import { cn } from "@/lib/utils";

const tabs = ["Concierge", "Saved", "Highlights"] as const;
export type Tab = (typeof tabs)[number];

interface TabNavProps {
  active: Tab;
  onTabChange: (tab: Tab) => void;
}

export function TabNav({ active, onTabChange }: TabNavProps) {
  return (
    <div className="sticky top-[57px] z-40 bg-background border-b">
      <div className="max-w-lg mx-auto flex">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors",
              active === tab
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}

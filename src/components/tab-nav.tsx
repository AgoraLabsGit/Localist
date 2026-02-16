"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const tabs = ["Saved", "Events", "Highlights"] as const;
type Tab = (typeof tabs)[number];

export function TabNav() {
  const [active, setActive] = useState<Tab>("Highlights");

  return (
    <div className="sticky top-[57px] z-40 bg-background border-b">
      <div className="max-w-lg mx-auto flex">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
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

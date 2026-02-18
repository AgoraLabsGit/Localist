"use client";

import { cn } from "@/lib/utils";

const tabs = ["My Places", "Concierge", "Explore"] as const;
export type Tab = (typeof tabs)[number];

interface TabNavProps {
  active: Tab;
  onTabChange: (tab: Tab) => void;
}

export function TabNav({ active, onTabChange }: TabNavProps) {
  return (
    <div className="flex w-full border-b border-slate-800" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab}
          role="tab"
          aria-selected={active === tab}
          onClick={() => onTabChange(tab)}
          className={cn(
            "flex-1 py-2.5 px-2 text-[16px] font-semibold font-display transition-colors touch-manipulation relative -mb-px",
            active === tab
              ? "text-[#E5E7EB]"
              : "text-[#64748b]/70 border-transparent hover:text-[#94A3B8]"
          )}
        >
          {tab}
          {active === tab && (
            <span
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[110%] h-[2px] bg-cyan-400 rounded-full"
              aria-hidden
            />
          )}
        </button>
      ))}
    </div>
  );
}

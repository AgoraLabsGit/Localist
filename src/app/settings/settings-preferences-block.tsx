"use client";

import { PreferencesSection } from "./preferences-section";

export function SettingsPreferencesBlock() {
  return (
    <div className="rounded-[20px] border border-[rgba(148,163,184,0.25)] bg-surface p-4">
      <PreferencesSection />
    </div>
  );
}

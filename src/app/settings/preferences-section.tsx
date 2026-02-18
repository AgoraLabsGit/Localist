"use client";

import { useState, useEffect } from "react";
import { TYPE_GROUPS, formatFilterLabel } from "@/components/filter-sheet";
import { cn } from "@/lib/utils";

const INTEREST_OPTIONS = TYPE_GROUPS.flatMap((g) => g.types);
const CHIP_SELECTED = "bg-accent-cyan/25 text-foreground border-accent-cyan";
const CHIP_UNSELECTED = "bg-transparent text-slate-400 border-[rgba(148,163,184,0.4)] hover:text-slate-300 hover:bg-slate-900/50";

interface Prefs {
  preferred_neighborhoods: string[];
  interests: string[];
}

export function PreferencesSection() {
  const [prefs, setPrefs] = useState<Prefs>({ preferred_neighborhoods: [], interests: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) =>
        setPrefs({
          preferred_neighborhoods: d.preferred_neighborhoods ?? [],
          interests: d.interests ?? [],
        })
      )
      .finally(() => setLoading(false));
  }, []);

  const toggleInterest = async (id: string) => {
    const next = prefs.interests.includes(id)
      ? prefs.interests.filter((x) => x !== id)
      : [...prefs.interests, id];
    setPrefs((p) => ({ ...p, interests: next }));
    setSaving(true);
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interests: next }),
    });
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground font-body">Loading…</p>;

  const selected = INTEREST_OPTIONS.filter((id) => prefs.interests.includes(id));
  const unselected = INTEREST_OPTIONS.filter((id) => !prefs.interests.includes(id));

  return (
    <div className="space-y-4 font-body">
      <h2 className="font-semibold text-foreground">Preferences</h2>
      <p className="text-sm text-muted-foreground">
        Used for Concierge recommendations.
      </p>
      <div>
        <p className="text-sm font-medium mb-2 text-foreground">Interests</p>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selected.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggleInterest(id)}
                disabled={saving}
                className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", CHIP_SELECTED)}
              >
                {formatFilterLabel(id)}
              </button>
            ))}
          </div>
        )}
        {unselected.length > 0 && (
          <>
            {selected.length > 0 && <p className="text-xs text-muted-foreground mb-2">More options</p>}
            <div className="flex flex-wrap gap-1.5">
              {unselected.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleInterest(id)}
                  disabled={saving}
                  className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", CHIP_UNSELECTED)}
                >
                  {formatFilterLabel(id)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

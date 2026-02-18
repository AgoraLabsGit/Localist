"use client";

import { useState, useEffect } from "react";
import { TYPE_GROUPS, formatFilterLabel } from "@/components/filter-sheet";
import { cn } from "@/lib/utils";

const INTEREST_OPTIONS = TYPE_GROUPS.flatMap((g) => g.types);
const CHIP_SELECTED = "bg-accent-cyan/25 text-foreground border-accent-cyan";
const CHIP_UNSELECTED = "bg-transparent text-slate-400 border-[rgba(148,163,184,0.4)] hover:text-slate-300 hover:bg-slate-900/50";

const SUGGESTED_DEFAULTS = {
  interests: ["cafe", "parrilla", "cocktail_bar"] as string[],
  primary_categories: ["cafe", "parrilla"] as string[],
  secondary_categories: ["cocktail_bar"] as string[],
};

interface Prefs {
  preferred_neighborhoods: string[];
  interests: string[];
  primary_categories: string[];
}

export function PreferencesSection() {
  const [prefs, setPrefs] = useState<Prefs>({ preferred_neighborhoods: [], interests: [], primary_categories: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) =>
        setPrefs({
          preferred_neighborhoods: d.preferred_neighborhoods ?? [],
          interests: d.interests ?? [],
          primary_categories: d.primary_categories ?? [],
        })
      )
      .finally(() => setLoading(false));
  }, []);

  const toggleInterest = async (id: string) => {
    const next = prefs.interests.includes(id)
      ? prefs.interests.filter((x) => x !== id)
      : [...prefs.interests, id];
    const nextPrimary = prefs.primary_categories.filter((x) => next.includes(x));
    setPrefs((p) => ({ ...p, interests: next, primary_categories: nextPrimary }));
    setSaving(true);
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interests: next, primary_categories: nextPrimary }),
    });
    setSaving(false);
  };

  const resetToDefaults = async () => {
    setPrefs({
      ...prefs,
      interests: SUGGESTED_DEFAULTS.interests,
      primary_categories: SUGGESTED_DEFAULTS.primary_categories,
    });
    setSaving(true);
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interests: SUGGESTED_DEFAULTS.interests,
        primary_categories: SUGGESTED_DEFAULTS.primary_categories,
        secondary_categories: SUGGESTED_DEFAULTS.secondary_categories,
      }),
    });
    setSaving(false);
  };

  const togglePrimary = async (id: string) => {
    const inPrimary = prefs.primary_categories.includes(id);
    const next = inPrimary
      ? prefs.primary_categories.filter((x) => x !== id)
      : prefs.primary_categories.length < 2
        ? [...prefs.primary_categories, id]
        : [prefs.primary_categories[1], id];
    setPrefs((p) => ({ ...p, primary_categories: next }));
    setSaving(true);
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primary_categories: next }),
    });
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground font-body">Loading…</p>;

  const selected = INTEREST_OPTIONS.filter((id) => prefs.interests.includes(id));
  const unselected = INTEREST_OPTIONS.filter((id) => !prefs.interests.includes(id));

  return (
    <div className="space-y-4 font-body">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-foreground">Preferences</h2>
          <p className="text-sm text-muted-foreground">
            Used for Concierge recommendations.
          </p>
        </div>
        <button
          type="button"
          onClick={resetToDefaults}
          disabled={saving}
          className="text-xs text-accent-cyan hover:underline shrink-0"
        >
          Reset to defaults
        </button>
      </div>
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
      {selected.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2 text-foreground">Top 2 that matter most</p>
          <p className="text-xs text-muted-foreground mb-2">Pick up to 2 for stronger weighting.</p>
          <div className="flex flex-wrap gap-1.5">
            {selected.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => togglePrimary(id)}
                disabled={saving}
                className={cn(
                  "text-sm font-body px-3 py-1.5 rounded-full border transition-colors",
                  prefs.primary_categories.includes(id) ? CHIP_SELECTED : CHIP_UNSELECTED
                )}
              >
                {formatFilterLabel(id)}
                {prefs.primary_categories.includes(id) ? " ★" : ""}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

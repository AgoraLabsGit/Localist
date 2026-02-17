"use client";

import { useState, useEffect } from "react";
import { NEIGHBORHOODS, TYPE_GROUPS, formatFilterLabel } from "@/components/filter-sheet";
import { cn } from "@/lib/utils";

const NEIGHBORHOOD_OPTIONS = NEIGHBORHOODS.filter((n) => n !== "all");
const INTEREST_OPTIONS = TYPE_GROUPS.flatMap((g) => g.types);

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

  const toggleNeighborhood = (n: string) => {
    setPrefs((p) => ({
      ...p,
      preferred_neighborhoods: p.preferred_neighborhoods.includes(n)
        ? p.preferred_neighborhoods.filter((x) => x !== n)
        : [...p.preferred_neighborhoods, n],
    }));
  };

  const toggleInterest = (id: string) => {
    setPrefs((p) => ({
      ...p,
      interests: p.interests.includes(id)
        ? p.interests.filter((x) => x !== id)
        : [...p.interests, id],
    }));
  };

  const save = async () => {
    setSaving(true);
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Preferences</h2>
      <p className="text-sm text-muted-foreground">
        Used for Concierge recommendations and the &quot;Your neighborhood&quot; filter.
      </p>
      <div>
        <p className="text-sm font-medium mb-2">Neighborhood(s)</p>
        <div className="flex flex-wrap gap-1.5">
          {NEIGHBORHOOD_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => toggleNeighborhood(n)}
              className={cn(
                "text-sm px-3 py-1.5 rounded-full transition-colors",
                prefs.preferred_neighborhoods.includes(n)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Interests</p>
        <div className="flex flex-wrap gap-1.5">
          {INTEREST_OPTIONS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggleInterest(id)}
              className={cn(
                "text-sm px-3 py-1.5 rounded-full transition-colors",
                prefs.interests.includes(id)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {formatFilterLabel(id)}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save preferences"}
      </button>
    </div>
  );
}

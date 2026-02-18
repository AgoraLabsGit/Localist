"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const CHIP_SELECTED = "bg-accent-cyan/25 text-foreground border-accent-cyan";
const CHIP_UNSELECTED = "bg-transparent text-slate-400 border-[rgba(148,163,184,0.4)] hover:text-slate-300 hover:bg-slate-900/50";

const PERSONA_OPTIONS = [
  { id: "local" as const, label: "I live here" },
  { id: "nomad" as const, label: "I'm here long-term (1–6 months)" },
  { id: "tourist" as const, label: "I'm visiting for a trip" },
];

const WEEKDAY_OPTIONS = [
  { id: "cafes_work", label: "Cafés to work or read" },
  { id: "parks_walks", label: "Parks & walks" },
  { id: "after_work_drinks", label: "After-work drinks" },
  { id: "quiet_dinners", label: "Quiet dinners" },
  { id: "quick_lunch", label: "Quick lunch spots" },
  { id: "culture", label: "Culture (museums, galleries)" },
  { id: "gym_fitness", label: "Gym or fitness nearby" },
  { id: "shopping", label: "Shopping or errands" },
];

const WEEKEND_OPTIONS = [
  { id: "bars_nightlife", label: "Bars & nightlife" },
  { id: "live_music", label: "Live music / shows" },
  { id: "food_spots", label: "Food spots & long dinners" },
  { id: "brunch", label: "Brunch" },
  { id: "day_trips", label: "Day trips / exploring neighborhoods" },
  { id: "chill_cafes_parks", label: "Chill cafés & parks" },
  { id: "markets", label: "Markets & street food" },
  { id: "sports", label: "Sports or outdoor activities" },
];

const VIBE_OPTIONS = [
  { id: "solo_friendly", label: "Solo-friendly" },
  { id: "group_friendly", label: "Group-friendly" },
  { id: "date_night", label: "Date night" },
  { id: "lively", label: "Lively" },
  { id: "touristy", label: "Touristy hits" },
  { id: "local", label: "More local / low-key" },
  { id: "hidden_gem", label: "Hidden gems" },
  { id: "local_favorite", label: "Local favorites" },
];

const BUDGET_OPTIONS = [
  { id: "cheap" as const, label: "Mostly cheap" },
  { id: "mid" as const, label: "Mid-range" },
  { id: "splurge" as const, label: "Happy to splurge sometimes" },
];

async function patchPrefs(payload: Record<string, unknown>) {
  const res = await fetch("/api/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to save");
}

export function PersonaSection() {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) => setValue(d.persona_type ?? null))
      .finally(() => setLoading(false));
  }, []);

  const select = async (v: string) => {
    const next = value === v ? null : v;
    setSaving(true);
    await patchPrefs({ persona_type: next });
    setValue(next);
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground font-body">Loading…</p>;

  return (
    <div className="space-y-4 font-body">
      <h2 className="font-semibold text-foreground">Persona</h2>
      <p className="text-sm text-muted-foreground">
        What best describes you in this city. Helps tailor Concierge suggestions.
      </p>
      <div className="flex flex-col gap-2">
        {PERSONA_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => select(o.id)}
            disabled={saving}
            className={cn(
              "w-full text-left px-4 py-3 rounded-[14px] border text-sm font-body transition-colors touch-manipulation",
              value === o.id ? CHIP_SELECTED : CHIP_UNSELECTED
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WeekdayPreferencesSection() {
  const [values, setValues] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) => setValues(d.weekday_preferences ?? []))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (id: string) => {
    const next = values.includes(id) ? values.filter((x) => x !== id) : [...values, id];
    setValues(next);
    setSaving(true);
    await patchPrefs({ weekday_preferences: next });
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground font-body">Loading…</p>;

  const selected = WEEKDAY_OPTIONS.filter((o) => values.includes(o.id));
  const unselected = WEEKDAY_OPTIONS.filter((o) => !values.includes(o.id));

  return (
    <div className="space-y-4 font-body">
      <h2 className="font-semibold text-foreground">Weekday Preferences</h2>
      <p className="text-sm text-muted-foreground">
        What you&apos;re most in the mood for during the week.
      </p>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selected.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", CHIP_SELECTED)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {unselected.length > 0 && (
        <>
          {selected.length > 0 && <p className="text-xs text-muted-foreground mb-2">More options</p>}
          <div className="flex flex-wrap gap-1.5">
            {unselected.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.id)}
                disabled={saving}
                className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", CHIP_UNSELECTED)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function WeekendPreferencesSection() {
  const [values, setValues] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) => setValues(d.weekend_preferences ?? []))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (id: string) => {
    const next = values.includes(id) ? values.filter((x) => x !== id) : [...values, id];
    setValues(next);
    setSaving(true);
    await patchPrefs({ weekend_preferences: next });
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground font-body">Loading…</p>;

  const selected = WEEKEND_OPTIONS.filter((o) => values.includes(o.id));
  const unselected = WEEKEND_OPTIONS.filter((o) => !values.includes(o.id));

  return (
    <div className="space-y-4 font-body">
      <h2 className="font-semibold text-foreground">Weekend Preferences</h2>
      <p className="text-sm text-muted-foreground">
        What sounds most like you on weekends.
      </p>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selected.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", CHIP_SELECTED)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {unselected.length > 0 && (
        <>
          {selected.length > 0 && <p className="text-xs text-muted-foreground mb-2">More options</p>}
          <div className="flex flex-wrap gap-1.5">
            {unselected.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.id)}
                disabled={saving}
                className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", CHIP_UNSELECTED)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function VibeTagsSection() {
  const [values, setValues] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) => setValues(d.vibe_tags_preferred ?? []))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (id: string) => {
    const next = values.includes(id) ? values.filter((x) => x !== id) : [...values, id];
    setValues(next);
    setSaving(true);
    await patchPrefs({ vibe_tags_preferred: next });
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground font-body">Loading…</p>;

  const selected = VIBE_OPTIONS.filter((o) => values.includes(o.id));
  const unselected = VIBE_OPTIONS.filter((o) => !values.includes(o.id));

  return (
    <div className="space-y-4 font-body">
      <h2 className="font-semibold text-foreground">Vibe Preferences</h2>
      <p className="text-sm text-muted-foreground">
        What kind of places you prefer.
      </p>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selected.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", CHIP_SELECTED)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {unselected.length > 0 && (
        <>
          {selected.length > 0 && <p className="text-xs text-muted-foreground mb-2">More options</p>}
          <div className="flex flex-wrap gap-1.5">
            {unselected.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.id)}
                disabled={saving}
                className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", CHIP_UNSELECTED)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function BudgetSection() {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) => setValue(d.budget_band ?? null))
      .finally(() => setLoading(false));
  }, []);

  const select = async (v: string) => {
    const next = value === v ? null : v;
    setSaving(true);
    await patchPrefs({ budget_band: next });
    setValue(next);
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground font-body">Loading…</p>;

  return (
    <div className="space-y-4 font-body">
      <h2 className="font-semibold text-foreground">Budget</h2>
      <p className="text-sm text-muted-foreground">
        Your usual going-out budget.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {BUDGET_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => select(o.id)}
            disabled={saving}
            className={cn(
              "text-sm font-body px-3 py-1.5 rounded-full border transition-colors",
              value === o.id ? CHIP_SELECTED : CHIP_UNSELECTED
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
  { id: "cozy", label: "Cozy" },
  { id: "lively", label: "Lively" },
];

const BUDGET_OPTIONS = [
  { id: "cheap" as const, label: "Mostly cheap" },
  { id: "mid" as const, label: "Mid-range" },
  { id: "splurge" as const, label: "Happy to splurge sometimes" },
];

const WEEKLY_OUTING_OPTIONS = [
  { id: 1, label: "0–1 a week" },
  { id: 2, label: "2–3 a week" },
  { id: 3, label: "4–5 a week" },
  { id: 4, label: "6+ a week" },
];

const TIME_BLOCK_OPTIONS = [
  { id: "weekday_evenings", label: "Weekday evenings" },
  { id: "weekend_afternoons", label: "Weekend afternoons" },
  { id: "weekend_evenings", label: "Weekend evenings" },
  { id: "sunday_daytime", label: "Sunday daytime" },
];

const TYPICAL_GROUP_OPTIONS = [
  { id: "solo" as const, label: "Usually solo" },
  { id: "couple" as const, label: "With a partner" },
  { id: "friends" as const, label: "With friends" },
  { id: "mixed" as const, label: "It varies" },
];

const TOURISTY_VS_LOCAL_OPTIONS = [
  { id: "touristy_ok" as const, label: "Mostly touristy is fine" },
  { id: "balanced" as const, label: "Mix of both" },
  { id: "local_only" as const, label: "Prefer local / off the beaten path" },
];

const DIETARY_OPTIONS = [
  { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "gluten_free", label: "Gluten-free" },
];

const ALCOHOL_OPTIONS = [
  { id: "okay" as const, label: "I drink" },
  { id: "lowkey" as const, label: "Sometimes / low-key" },
  { id: "avoid" as const, label: "I avoid alcohol" },
];

const RADIUS_OPTIONS = [
  { id: "near_home" as const, label: "Stay near home" },
  { id: "few_barrios" as const, label: "A few neighborhoods" },
  { id: "whole_city" as const, label: "Explore the whole city" },
];

const EXPLORATION_OPTIONS = [
  { id: "favorites" as const, label: "Stick to favorites" },
  { id: "balanced" as const, label: "Mix of both" },
  { id: "adventurous" as const, label: "Always discovering new spots" },
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

export function WhenAndHowOftenSection() {
  const [weeklyOuting, setWeeklyOuting] = useState<number | null>(null);
  const [timeBlocks, setTimeBlocks] = useState<string[]>([]);
  const [typicalGroup, setTypicalGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) => {
        setWeeklyOuting(d.weekly_outing_target ?? null);
        setTimeBlocks(d.preferred_time_blocks ?? []);
        setTypicalGroup(d.typical_group_type ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleTimeBlock = async (id: string) => {
    const next = timeBlocks.includes(id) ? timeBlocks.filter((x) => x !== id) : [...timeBlocks, id];
    setTimeBlocks(next);
    setSaving(true);
    await patchPrefs({ preferred_time_blocks: next });
    setSaving(false);
  };

  const setWeekly = async (v: number | null) => {
    setWeeklyOuting(v);
    setSaving(true);
    await patchPrefs({ weekly_outing_target: v });
    setSaving(false);
  };

  const setGroup = async (v: string | null) => {
    setTypicalGroup(v);
    setSaving(true);
    await patchPrefs({ typical_group_type: v });
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground font-body">Loading…</p>;

  return (
    <div className="space-y-4 font-body">
      <h2 className="font-semibold text-foreground">When & How Often</h2>
      <p className="text-sm text-muted-foreground">Weekly outings, preferred times, typical group.</p>
      <div>
        <p className="text-sm font-medium mb-2">Weekly outings</p>
        <div className="flex flex-wrap gap-1.5">
          {WEEKLY_OUTING_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setWeekly(weeklyOuting === o.id ? null : o.id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", weeklyOuting === o.id ? CHIP_SELECTED : CHIP_UNSELECTED)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Preferred times</p>
        <div className="flex flex-wrap gap-1.5">
          {TIME_BLOCK_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => toggleTimeBlock(o.id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", timeBlocks.includes(o.id) ? CHIP_SELECTED : CHIP_UNSELECTED)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Usually going out with</p>
        <div className="flex flex-wrap gap-1.5">
          {TYPICAL_GROUP_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setGroup(typicalGroup === o.id ? null : o.id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", typicalGroup === o.id ? CHIP_SELECTED : CHIP_UNSELECTED)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TouristVsLocalSection() {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) => setValue(d.touristy_vs_local_preference ?? null))
      .finally(() => setLoading(false));
  }, []);

  const select = async (v: string) => {
    const next = value === v ? null : v;
    setSaving(true);
    await patchPrefs({ touristy_vs_local_preference: next });
    setValue(next);
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground font-body">Loading…</p>;

  return (
    <div className="space-y-4 font-body">
      <h2 className="font-semibold text-foreground">Touristy vs Local</h2>
      <p className="text-sm text-muted-foreground">Balance of classic hits vs off the beaten path.</p>
      <div className="flex flex-wrap gap-1.5">
        {TOURISTY_VS_LOCAL_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => select(o.id)}
            disabled={saving}
            className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", value === o.id ? CHIP_SELECTED : CHIP_UNSELECTED)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ConstraintsSection() {
  const [dietary, setDietary] = useState<string[]>([]);
  const [alcohol, setAlcohol] = useState<string | null>(null);
  const [radius, setRadius] = useState<string | null>(null);
  const [exploration, setExploration] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) => {
        setDietary(d.dietary_flags ?? []);
        setAlcohol(d.alcohol_preference ?? null);
        setRadius(d.radius_preference ?? null);
        setExploration(d.exploration_style ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleDietary = async (id: string) => {
    const next = dietary.includes(id) ? dietary.filter((x) => x !== id) : [...dietary, id];
    setDietary(next);
    setSaving(true);
    await patchPrefs({ dietary_flags: next });
    setSaving(false);
  };

  const setAlcoholPref = async (v: string | null) => {
    setAlcohol(v);
    setSaving(true);
    await patchPrefs({ alcohol_preference: v });
    setSaving(false);
  };

  const setRadiusPref = async (v: string | null) => {
    setRadius(v);
    setSaving(true);
    await patchPrefs({ radius_preference: v });
    setSaving(false);
  };

  const setExplorationPref = async (v: string | null) => {
    setExploration(v);
    setSaving(true);
    await patchPrefs({ exploration_style: v });
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground font-body">Loading…</p>;

  return (
    <div className="space-y-4 font-body">
      <h2 className="font-semibold text-foreground">Constraints & Exploration</h2>
      <p className="text-sm text-muted-foreground">Dietary, alcohol, how far you explore.</p>
      <div>
        <p className="text-sm font-medium mb-2">Dietary</p>
        <div className="flex flex-wrap gap-1.5">
          {DIETARY_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => toggleDietary(o.id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", dietary.includes(o.id) ? CHIP_SELECTED : CHIP_UNSELECTED)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Alcohol</p>
        <div className="flex flex-wrap gap-1.5">
          {ALCOHOL_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setAlcoholPref(alcohol === o.id ? null : o.id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", alcohol === o.id ? CHIP_SELECTED : CHIP_UNSELECTED)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">How far to explore</p>
        <div className="flex flex-wrap gap-1.5">
          {RADIUS_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setRadiusPref(radius === o.id ? null : o.id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", radius === o.id ? CHIP_SELECTED : CHIP_UNSELECTED)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Discover new spots or stick to favorites</p>
        <div className="flex flex-wrap gap-1.5">
          {EXPLORATION_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setExplorationPref(exploration === o.id ? null : o.id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", exploration === o.id ? CHIP_SELECTED : CHIP_UNSELECTED)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
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

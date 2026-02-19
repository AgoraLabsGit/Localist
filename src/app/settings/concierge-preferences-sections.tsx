"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const CHIP_SELECTED = "bg-accent-cyan/25 text-foreground border-accent-cyan";
const CHIP_UNSELECTED = "bg-transparent text-muted-foreground border-border-medium hover:text-foreground hover:bg-surface-alt";

const PERSONA_OPTIONS = [{ id: "local" as const }, { id: "nomad" as const }, { id: "tourist" as const }];

const WEEKDAY_OPTIONS = ["cafes_work", "parks_walks", "after_work_drinks", "quiet_dinners", "quick_lunch", "culture", "gym_fitness", "shopping"] as const;

const WEEKEND_OPTIONS = ["bars_nightlife", "live_music", "food_spots", "brunch", "day_trips", "chill_cafes_parks", "markets", "sports"] as const;

const VIBE_OPTIONS = ["solo_friendly", "group_friendly", "date_night", "cozy", "lively"] as const;

const BUDGET_OPTIONS = ["cheap", "mid", "splurge"] as const;

const WEEKLY_OUTING_IDS = [1, 2, 3, 4] as const;

const TIME_BLOCK_OPTIONS = ["weekday_evenings", "weekend_afternoons", "weekend_evenings", "sunday_daytime"] as const;

const TYPICAL_GROUP_OPTIONS = ["solo", "couple", "friends", "mixed"] as const;

const TOURISTY_VS_LOCAL_OPTIONS = ["touristy_ok", "balanced", "local_only"] as const;

const DIETARY_OPTIONS = ["vegetarian", "vegan", "gluten_free"] as const;

const ALCOHOL_OPTIONS = ["okay", "lowkey", "avoid"] as const;

const RADIUS_OPTIONS = ["near_home", "few_barrios", "whole_city"] as const;

const EXPLORATION_OPTIONS = ["favorites", "balanced", "adventurous"] as const;

async function patchPrefs(payload: Record<string, unknown>) {
  const res = await fetch("/api/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to save");
}

export function PersonaSection() {
  const t = useTranslations("settings.persona");
  const tOnb = useTranslations("onboarding.persona");
  const tCommon = useTranslations("common");
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

  if (loading) return <p className="text-sm text-muted-foreground font-body">{tCommon("loading")}</p>;

  return (
    <div className="space-y-4 font-body">
      <h2 className="font-semibold text-foreground">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
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
            {tOnb(o.id)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WeekdayPreferencesSection() {
  const t = useTranslations("settings.weekday");
  const tCommon = useTranslations("common");
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

  if (loading) return <p className="text-sm text-muted-foreground font-body">{tCommon("loading")}</p>;

  const selected = WEEKDAY_OPTIONS.filter((id) => values.includes(id));
  const unselected = WEEKDAY_OPTIONS.filter((id) => !values.includes(id));

  return (
    <div className="space-y-4 font-body">
      <h2 className="font-semibold text-foreground">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selected.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", CHIP_SELECTED)}
            >
              {t(id as any)}
            </button>
          ))}
        </div>
      )}
      {unselected.length > 0 && (
        <>
          {selected.length > 0 && <p className="text-xs text-muted-foreground mb-2">{tCommon("moreOptions")}</p>}
          <div className="flex flex-wrap gap-1.5">
            {unselected.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                disabled={saving}
                className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", CHIP_UNSELECTED)}
              >
                {t(id as any)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function WeekendPreferencesSection() {
  const t = useTranslations("settings.weekend");
  const tCommon = useTranslations("common");
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

  if (loading) return <p className="text-sm text-muted-foreground font-body">{tCommon("loading")}</p>;

  const selected = WEEKEND_OPTIONS.filter((id) => values.includes(id));
  const unselected = WEEKEND_OPTIONS.filter((id) => !values.includes(id));

  return (
    <div className="space-y-4 font-body">
      <h2 className="font-semibold text-foreground">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selected.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", CHIP_SELECTED)}
            >
              {t(id as any)}
            </button>
          ))}
        </div>
      )}
      {unselected.length > 0 && (
        <>
          {selected.length > 0 && <p className="text-xs text-muted-foreground mb-2">{tCommon("moreOptions")}</p>}
          <div className="flex flex-wrap gap-1.5">
            {unselected.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                disabled={saving}
                className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", CHIP_UNSELECTED)}
              >
                {t(id as any)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function VibeTagsSection() {
  const t = useTranslations("settings.vibePrefs");
  const tOnb = useTranslations("onboarding.vibe");
  const tCommon = useTranslations("common");
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

  if (loading) return <p className="text-sm text-muted-foreground font-body">{tCommon("loading")}</p>;

  const selected = VIBE_OPTIONS.filter((id) => values.includes(id));
  const unselected = VIBE_OPTIONS.filter((id) => !values.includes(id));

  return (
    <div className="space-y-4 font-body">
      <h2 className="font-semibold text-foreground">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selected.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", CHIP_SELECTED)}
            >
              {tOnb(id as any)}
            </button>
          ))}
        </div>
      )}
      {unselected.length > 0 && (
        <>
          {selected.length > 0 && <p className="text-xs text-muted-foreground mb-2">{tCommon("moreOptions")}</p>}
          <div className="flex flex-wrap gap-1.5">
            {unselected.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                disabled={saving}
                className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", CHIP_UNSELECTED)}
              >
                {tOnb(id as any)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function WhenAndHowOftenSection() {
  const t = useTranslations("settings.whenHowOften");
  const tOnbWeekly = useTranslations("onboarding.weeklyOutings");
  const tOnbTime = useTranslations("onboarding.timeBlocks");
  const tOnbGroup = useTranslations("onboarding.typicalGroup");
  const tCommon = useTranslations("common");
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

  if (loading) return <p className="text-sm text-muted-foreground font-body">{tCommon("loading")}</p>;

  return (
    <div className="space-y-4 font-body">
      <h2 className="font-semibold text-foreground">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      <div>
        <p className="text-sm font-medium mb-2">{t("weeklyOutings")}</p>
        <div className="flex flex-wrap gap-1.5">
          {WEEKLY_OUTING_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setWeekly(weeklyOuting === id ? null : id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", weeklyOuting === id ? CHIP_SELECTED : CHIP_UNSELECTED)}
            >
              {tOnbWeekly(String(id) as "1" | "2" | "3" | "4")}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">{t("preferredTimes")}</p>
        <div className="flex flex-wrap gap-1.5">
          {TIME_BLOCK_OPTIONS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggleTimeBlock(id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", timeBlocks.includes(id) ? CHIP_SELECTED : CHIP_UNSELECTED)}
            >
              {tOnbTime(id as any)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">{t("usuallyWith")}</p>
        <div className="flex flex-wrap gap-1.5">
          {TYPICAL_GROUP_OPTIONS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setGroup(typicalGroup === id ? null : id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", typicalGroup === id ? CHIP_SELECTED : CHIP_UNSELECTED)}
            >
              {tOnbGroup(id as any)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TouristVsLocalSection() {
  const t = useTranslations("settings.touristyVsLocalPrefs");
  const tOnb = useTranslations("onboarding.touristyVsLocal");
  const tCommon = useTranslations("common");
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

  if (loading) return <p className="text-sm text-muted-foreground font-body">{tCommon("loading")}</p>;

  return (
    <div className="space-y-4 font-body">
      <h2 className="font-semibold text-foreground">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      <div className="flex flex-wrap gap-1.5">
        {TOURISTY_VS_LOCAL_OPTIONS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => select(id)}
            disabled={saving}
            className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", value === id ? CHIP_SELECTED : CHIP_UNSELECTED)}
          >
            {tOnb(id as any)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ConstraintsSection() {
  const t = useTranslations("settings.constraints");
  const tRadius = useTranslations("onboarding.radius");
  const tExploration = useTranslations("onboarding.exploration");
  const tCommon = useTranslations("common");
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

  if (loading) return <p className="text-sm text-muted-foreground font-body">{tCommon("loading")}</p>;

  return (
    <div className="space-y-4 font-body">
      <h2 className="font-semibold text-foreground">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      <div>
        <p className="text-sm font-medium mb-2">{t("dietary")}</p>
        <div className="flex flex-wrap gap-1.5">
          {DIETARY_OPTIONS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggleDietary(id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", dietary.includes(id) ? CHIP_SELECTED : CHIP_UNSELECTED)}
            >
              {t(id as any)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">{t("alcohol")}</p>
        <div className="flex flex-wrap gap-1.5">
          {ALCOHOL_OPTIONS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setAlcoholPref(alcohol === id ? null : id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", alcohol === id ? CHIP_SELECTED : CHIP_UNSELECTED)}
            >
              {t(id as any)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">{t("howFarToExplore")}</p>
        <div className="flex flex-wrap gap-1.5">
          {RADIUS_OPTIONS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setRadiusPref(radius === id ? null : id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", radius === id ? CHIP_SELECTED : CHIP_UNSELECTED)}
            >
              {tRadius(id as any)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">{t("discoverOrStick")}</p>
        <div className="flex flex-wrap gap-1.5">
          {EXPLORATION_OPTIONS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setExplorationPref(exploration === id ? null : id)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", exploration === id ? CHIP_SELECTED : CHIP_UNSELECTED)}
            >
              {tExploration(id as any)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BudgetSection() {
  const t = useTranslations("settings.budgetPrefs");
  const tOnb = useTranslations("onboarding.budget");
  const tCommon = useTranslations("common");
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

  if (loading) return <p className="text-sm text-muted-foreground font-body">{tCommon("loading")}</p>;

  return (
    <div className="space-y-4 font-body">
      <h2 className="font-semibold text-foreground">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      <div className="flex flex-wrap gap-1.5">
        {BUDGET_OPTIONS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => select(id)}
            disabled={saving}
            className={cn(
              "text-sm font-body px-3 py-1.5 rounded-full border transition-colors",
              value === id ? CHIP_SELECTED : CHIP_UNSELECTED
            )}
          >
            {tOnb(id as any)}
          </button>
        ))}
      </div>
    </div>
  );
}

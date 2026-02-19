"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { TYPE_GROUPS } from "@/components/filter-sheet";
import { cn } from "@/lib/utils";

const INTEREST_OPTIONS = TYPE_GROUPS.flatMap((g) => g.types);
const CHIP_SELECTED = "bg-accent-cyan/25 text-foreground border-accent-cyan";
const CHIP_UNSELECTED = "bg-transparent text-muted-foreground border-border-medium hover:text-foreground hover:bg-surface-alt";

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
  const t = useTranslations("settings.preferences");
  const tCommon = useTranslations("common");
  const tTypes = useTranslations("placeTypes");
  const [prefs, setPrefs] = useState<Prefs>({ preferred_neighborhoods: [], interests: [], primary_categories: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const formatLabel = (id: string) => tTypes(id as any) || id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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

  if (loading) return <p className="text-sm text-muted-foreground font-body">{tCommon("loading")}</p>;

  const selected = INTEREST_OPTIONS.filter((id) => prefs.interests.includes(id));
  const unselected = INTEREST_OPTIONS.filter((id) => !prefs.interests.includes(id));

  return (
    <div className="space-y-4 font-body">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-foreground">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("usedForConcierge")}
          </p>
        </div>
        <button
          type="button"
          onClick={resetToDefaults}
          disabled={saving}
          className="text-xs text-accent-cyan hover:underline shrink-0"
        >
          {t("resetToDefaults")}
        </button>
      </div>
      <div>
        <p className="text-sm font-medium mb-2 text-foreground">{t("interests")}</p>
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
                {formatLabel(id)}
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
                  onClick={() => toggleInterest(id)}
                  disabled={saving}
                  className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", CHIP_UNSELECTED)}
                >
                  {formatLabel(id)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {selected.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2 text-foreground">{t("top2")}</p>
          <p className="text-xs text-muted-foreground mb-2">{t("pickUpTo2")}</p>
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
                {formatLabel(id)}
                {prefs.primary_categories.includes(id) ? " ★" : ""}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

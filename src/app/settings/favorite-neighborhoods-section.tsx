"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useNeighborhoods } from "@/hooks/use-neighborhoods";
import { cn } from "@/lib/utils";

const CHIP_SELECTED = "bg-accent-cyan/25 text-foreground border-accent-cyan";
const CHIP_UNSELECTED = "bg-transparent text-muted-foreground border-border-medium hover:text-foreground hover:bg-surface-alt";
const VISIBLE_INITIAL = 6;

interface FavoritePrefs {
  home_city: string;
  preferred_neighborhoods: string[];
  primary_neighborhood_freeform: string | null;
}

export function FavoriteNeighborhoodsSection() {
  const [prefs, setPrefs] = useState<FavoritePrefs>({
    home_city: "Buenos Aires",
    preferred_neighborhoods: [],
    primary_neighborhood_freeform: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showFreeform, setShowFreeform] = useState(false);
  const [freeformValue, setFreeformValue] = useState("");
  const { neighborhoods } = useNeighborhoods(prefs.home_city);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) => {
        setPrefs({
          home_city: d.home_city ?? "Buenos Aires",
          preferred_neighborhoods: d.preferred_neighborhoods ?? [],
          primary_neighborhood_freeform: d.primary_neighborhood_freeform ?? null,
        });
        setFreeformValue(d.primary_neighborhood_freeform ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async (updates: Partial<FavoritePrefs>) => {
    setSaving(true);
    const next = { ...prefs, ...updates };
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preferred_neighborhoods: next.preferred_neighborhoods,
        primary_neighborhood_freeform: next.primary_neighborhood_freeform,
      }),
    });
    setPrefs(next);
    setSaving(false);
    setShowFreeform(false);
  };

  const toggleNeighborhood = (n: string) => {
    const next = prefs.preferred_neighborhoods.includes(n)
      ? prefs.preferred_neighborhoods.filter((x) => x !== n)
      : [...prefs.preferred_neighborhoods, n];
    save({ preferred_neighborhoods: next, primary_neighborhood_freeform: null });
  };

  const t = useTranslations("common");
  const tSettings = useTranslations("settings");

  if (loading) return <p className="text-sm text-muted-foreground font-body">{t("loading")}</p>;

  const selected = prefs.preferred_neighborhoods;
  const unselected = neighborhoods.filter((n) => !prefs.preferred_neighborhoods.includes(n));
  const visibleUnselectedCount = showMore ? unselected.length : Math.min(VISIBLE_INITIAL, unselected.length);
  const visibleUnselected = unselected.slice(0, visibleUnselectedCount);
  const hasMore = unselected.length > VISIBLE_INITIAL;

  return (
    <div className="space-y-4 font-body">
      <h2 className="font-semibold text-foreground">{tSettings("favoriteNeighborhoodsTitle")}</h2>
      <p className="text-sm text-muted-foreground">
        {tSettings("favoriteAreasDesc")}
      </p>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => toggleNeighborhood(n)}
              disabled={saving}
              className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", CHIP_SELECTED)}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => { setFreeformValue(prefs.primary_neighborhood_freeform ?? ""); setShowFreeform(true); }}
          className={cn(
            "text-sm font-body px-3 py-1.5 rounded-full border border-dashed transition-colors",
            prefs.primary_neighborhood_freeform ? CHIP_SELECTED : CHIP_UNSELECTED
          )}
        >
          {prefs.primary_neighborhood_freeform ?? t("anotherNeighborhood")}
        </button>
        <button
          type="button"
          onClick={() => save({ preferred_neighborhoods: [], primary_neighborhood_freeform: null })}
          disabled={saving}
          className={cn(
            "text-sm font-body px-3 py-1.5 rounded-full border transition-colors",
            prefs.preferred_neighborhoods.length === 0 && !prefs.primary_neighborhood_freeform ? CHIP_SELECTED : CHIP_UNSELECTED
          )}
        >
          {t("clearAll")}
        </button>
      </div>
      {unselected.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">{t("moreOptions")}</p>
          <div className="flex flex-wrap gap-1.5">
            {visibleUnselected.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => toggleNeighborhood(n)}
                disabled={saving}
                className={cn("text-sm font-body px-3 py-1.5 rounded-full border transition-colors", CHIP_UNSELECTED)}
              >
                {n}
              </button>
            ))}
          </div>
        </>
      )}
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          className="text-sm text-accent-cyan hover:underline font-medium"
        >
          {showMore ? t("showLess") : t("showMore")}
        </button>
      )}
      {showFreeform && (
        <div className="space-y-2 pt-2 border-t border-border-app">
          <input
            type="text"
            value={freeformValue}
            onChange={(e) => setFreeformValue(e.target.value)}
            placeholder={tSettings("neighborhoodPlaceholder")}
            className="w-full rounded-[14px] border border-border-medium bg-surface px-4 py-3 text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-cyan/30"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowFreeform(false); setFreeformValue(""); }}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const freeform = freeformValue.trim() || null;
                const next = freeform
                  ? [...prefs.preferred_neighborhoods.filter((x) => x !== freeform), freeform]
                  : prefs.preferred_neighborhoods;
                save({ preferred_neighborhoods: next, primary_neighborhood_freeform: freeform });
              }}
              disabled={saving}
              className="flex-1 rounded-[14px] bg-accent-cyan py-2 text-sm font-medium text-white hover:bg-accent-cyan/90 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

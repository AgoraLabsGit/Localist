"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { SUPPORTED_CITIES } from "@/lib/cities";
import { useCities, getClosestCity } from "@/hooks/use-cities";
import { useNeighborhoods } from "@/hooks/use-neighborhoods";
import { cn } from "@/lib/utils";

const CHIP_SELECTED = "bg-accent-cyan/25 text-foreground border-accent-cyan";
const CHIP_UNSELECTED = "bg-transparent text-muted-foreground border-border-medium hover:text-foreground hover:bg-surface-alt";

interface LocationPrefs {
  home_city: string;
  home_neighborhood: string | null;
}

export function LocationSection() {
  const [prefs, setPrefs] = useState<LocationPrefs>({
    home_city: "Buenos Aires",
    home_neighborhood: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showHomeNeighborhoodEdit, setShowHomeNeighborhoodEdit] = useState(false);
  const { cities } = useCities();
  const { neighborhoods } = useNeighborhoods(prefs.home_city);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) => {
        setPrefs({
          home_city: d.home_city ?? "Buenos Aires",
          home_neighborhood: d.home_neighborhood ?? null,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async (updates: Partial<LocationPrefs>) => {
    setSaving(true);
    const next = { ...prefs, ...updates };
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        home_city: next.home_city,
        home_neighborhood: next.home_neighborhood,
      }),
    });
    setPrefs(next);
    setSaving(false);
    setShowCityPicker(false);
    setShowHomeNeighborhoodEdit(false);
  };

  const t = useTranslations("common");
  const tSettings = useTranslations("settings");

  if (loading) return <p className="text-sm text-muted-foreground font-body">{t("loading")}</p>;

  return (
    <div className="space-y-4 font-body">
      <h2 className="font-semibold text-foreground">{tSettings("location")}</h2>
      <p className="text-sm text-muted-foreground">
        {tSettings("locationScope")}
      </p>

      {/* City */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-sm font-medium text-foreground">{t("city")}</p>
          <button
            type="button"
            onClick={() => setShowCityPicker(!showCityPicker)}
            className="text-accent-cyan hover:underline text-sm font-medium shrink-0"
          >
            {showCityPicker ? t("done") : t("edit")}
          </button>
        </div>
        {showCityPicker ? (
          <CityPicker
            homeCity={prefs.home_city}
            onCityChange={(city) => save({ home_city: city })}
            onCancel={() => setShowCityPicker(false)}
            saving={saving}
            cities={cities}
            chipSelected={CHIP_SELECTED}
            chipUnselected={CHIP_UNSELECTED}
          />
        ) : (
          <p className="text-foreground">{prefs.home_city}</p>
        )}
      </div>

      {/* Home Neighborhood */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{t("homeNeighborhood")}</p>
          <button
            type="button"
            onClick={() => setShowHomeNeighborhoodEdit(!showHomeNeighborhoodEdit)}
            className="text-accent-cyan hover:underline text-sm font-medium shrink-0"
          >
            {showHomeNeighborhoodEdit ? t("done") : t("edit")}
          </button>
        </div>
        {showHomeNeighborhoodEdit ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {neighborhoods.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => save({ home_neighborhood: prefs.home_neighborhood === n ? null : n })}
                disabled={saving}
                className={cn(
                  "text-sm font-body px-3 py-1.5 rounded-full border transition-colors",
                  prefs.home_neighborhood === n ? CHIP_SELECTED : CHIP_UNSELECTED
                )}
              >
                {n}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-foreground">{prefs.home_neighborhood ?? t("notSet")}</p>
        )}
      </div>
    </div>
  );
}

function CityPicker({
  homeCity,
  onCityChange,
  onCancel,
  saving,
  cities,
  chipSelected,
  chipUnselected,
}: {
  homeCity: string;
  onCityChange: (city: string) => void;
  onCancel: () => void;
  saving: boolean;
  cities: { id: string; name: string; center?: { lat: number; lng: number } }[];
  chipSelected: string;
  chipUnselected: string;
}) {
  const tOnb = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const [query, setQuery] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const citiesList = cities.length > 0 ? cities : SUPPORTED_CITIES;

  useEffect(() => {
    let cancelled = false;
    if (!navigator.geolocation || citiesList.length === 0) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const city = getClosestCity(citiesList, pos.coords.latitude, pos.coords.longitude);
        if (city) onCityChange(city.name);
        setGeoLoading(false);
      },
      () => { if (!cancelled) setGeoLoading(false); },
      { enableHighAccuracy: false, timeout: 5000 }
    );
    return () => { cancelled = true; };
  }, [onCityChange, citiesList.length]);

  const filtered = citiesList.filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  const selectedCity = citiesList.find((c) => c.name === homeCity);

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={tOnb("cityPlaceholder")}
        className="w-full rounded-[14px] border border-border-medium bg-surface px-4 py-3 text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-cyan/30"
      />
      {geoLoading && <p className="text-xs text-muted-foreground">{tCommon("detecting")}</p>}
      <div className="flex flex-wrap gap-1.5">
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onCityChange(c.name)}
            disabled={saving}
            className={cn(
              "text-sm font-body px-3 py-1.5 rounded-full border transition-colors",
              selectedCity?.id === c.id ? chipSelected : chipUnselected
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}

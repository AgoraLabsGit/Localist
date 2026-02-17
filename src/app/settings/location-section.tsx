"use client";

import { useState, useEffect } from "react";
import { SUPPORTED_CITIES, NEIGHBORHOODS_BY_CITY, getClosestSupportedCity } from "@/lib/cities";
import { cn } from "@/lib/utils";

interface LocationPrefs {
  home_city: string;
  primary_neighborhood: string | null;
  primary_neighborhood_freeform: string | null;
}

export function LocationSection() {
  const [prefs, setPrefs] = useState<LocationPrefs>({
    home_city: "Buenos Aires",
    primary_neighborhood: null,
    primary_neighborhood_freeform: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showFreeform, setShowFreeform] = useState(false);
  const [freeformValue, setFreeformValue] = useState("");

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) => {
        setPrefs({
          home_city: d.home_city ?? "Buenos Aires",
          primary_neighborhood: d.primary_neighborhood ?? null,
          primary_neighborhood_freeform: d.primary_neighborhood_freeform ?? null,
        });
        setFreeformValue(d.primary_neighborhood_freeform ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  const cityId = SUPPORTED_CITIES.find((c) => c.name === prefs.home_city)?.id ?? "buenos-aires";
  const neighborhoods = NEIGHBORHOODS_BY_CITY[cityId] ?? NEIGHBORHOODS_BY_CITY["buenos-aires"] ?? [];

  const save = async (updates: Partial<LocationPrefs>) => {
    setSaving(true);
    const next = { ...prefs, ...updates };
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...next,
        preferred_neighborhoods: next.primary_neighborhood ? [next.primary_neighborhood] : [],
      }),
    });
    setPrefs((p) => ({ ...p, ...updates }));
    setSaving(false);
    setShowCityPicker(false);
    setShowFreeform(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Location</h2>
      <p className="text-sm text-muted-foreground">
        Used to scope your feed and personalize recommendations.
      </p>

      <div>
        <p className="text-sm font-medium mb-1">City</p>
        {showCityPicker ? (
          <CityPicker
            homeCity={prefs.home_city}
            onCityChange={(city) => save({ home_city: city })}
            onCancel={() => setShowCityPicker(false)}
            saving={saving}
          />
        ) : (
          <p className="text-muted-foreground">
            {prefs.home_city}{" "}
            <button
              type="button"
              onClick={() => setShowCityPicker(true)}
              className="text-primary hover:underline text-sm"
            >
              Change city
            </button>
          </p>
        )}
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Neighborhood</p>
        {showFreeform ? (
          <div className="space-y-2">
            <input
              type="text"
              value={freeformValue}
              onChange={(e) => setFreeformValue(e.target.value)}
              placeholder="Type your neighborhood (optional)"
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowFreeform(false);
                  setFreeformValue("");
                }}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => save({ primary_neighborhood: null, primary_neighborhood_freeform: freeformValue.trim() || null })}
                disabled={saving}
                className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {neighborhoods.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => save({ primary_neighborhood: n, primary_neighborhood_freeform: null })}
                disabled={saving}
                className={cn(
                  "text-sm px-3 py-1.5 rounded-full transition-colors",
                  prefs.primary_neighborhood === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowFreeform(true)}
              className={cn(
                "text-sm px-3 py-1.5 rounded-full border border-dashed transition-colors",
                prefs.primary_neighborhood_freeform ? "border-primary text-primary" : "border-muted-foreground/50 text-muted-foreground hover:bg-muted/50"
              )}
            >
              Another neighborhood
            </button>
            <button
              type="button"
              onClick={() => save({ primary_neighborhood: null, primary_neighborhood_freeform: null })}
              disabled={saving}
              className={cn(
                "text-sm px-3 py-1.5 rounded-full transition-colors",
                !prefs.primary_neighborhood && !prefs.primary_neighborhood_freeform ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              I&apos;m not sure yet
            </button>
          </div>
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
}: {
  homeCity: string;
  onCityChange: (city: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [query, setQuery] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const city = getClosestSupportedCity(pos.coords.latitude, pos.coords.longitude);
        if (city) onCityChange(city.name);
        setGeoLoading(false);
      },
      () => { if (!cancelled) setGeoLoading(false); },
      { enableHighAccuracy: false, timeout: 5000 }
    );
    return () => { cancelled = true; };
  }, [onCityChange]);

  const filtered = SUPPORTED_CITIES.filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  const selectedCity = SUPPORTED_CITIES.find((c) => c.name === homeCity);

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search cities…"
        className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm"
      />
      {geoLoading && <p className="text-xs text-muted-foreground">Detecting location…</p>}
      <div className="flex flex-wrap gap-2">
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onCityChange(c.name)}
            disabled={saving}
            className={cn(
              "text-sm font-medium px-4 py-2 rounded-full transition-colors",
              selectedCity?.id === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
      <button type="button" onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground">
        Cancel
      </button>
    </div>
  );
}

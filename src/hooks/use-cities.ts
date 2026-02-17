"use client";

import { useState, useEffect } from "react";

export interface SupportedCity {
  id: string;
  name: string;
  center?: { lat: number; lng: number };
  is_default?: boolean;
}

export function useCities() {
  const [cities, setCities] = useState<SupportedCity[]>([]);
  const [defaultCityName, setDefaultCityName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cities")
      .then((r) => r.json())
      .then((d) => {
        setCities(d.cities ?? []);
        setDefaultCityName(d.defaultCityName ?? null);
      })
      .catch(() => {
        setCities([]);
        setDefaultCityName(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return { cities, defaultCityName, loading };
}

export function getClosestCity(
  cities: SupportedCity[],
  lat: number,
  lng: number
): SupportedCity | null {
  if (cities.length === 0) return null;
  if (cities.length === 1) return cities[0];
  let closest = cities[0];
  let minDist = Infinity;
  for (const c of cities) {
    if (!c.center) continue;
    const d = Math.hypot(c.center.lat - lat, c.center.lng - lng);
    if (d < minDist) {
      minDist = d;
      closest = c;
    }
  }
  return closest;
}

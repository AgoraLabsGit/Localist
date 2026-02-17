"use client";

import { useState, useEffect } from "react";

export function useNeighborhoods(cityName: string | null) {
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cityName?.trim()) {
      setNeighborhoods([]);
      return;
    }
    setLoading(true);
    fetch(`/api/neighborhoods?city=${encodeURIComponent(cityName.trim())}`)
      .then((r) => r.json())
      .then((d) => setNeighborhoods(d.neighborhoods ?? []))
      .catch(() => setNeighborhoods([]))
      .finally(() => setLoading(false));
  }, [cityName]);

  return { neighborhoods, loading };
}

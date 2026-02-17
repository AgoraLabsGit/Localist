"use client";

import { useState } from "react";

interface CityDetailClientProps {
  city: {
    id: string;
    slug: string;
    name: string;
    center_lat: number;
    center_lng: number;
    radius_meters: number;
    geocode_language: string;
    status: string;
  };
  neighborhoods: { id: string; name: string }[];
  categories: {
    id: string;
    slug: string;
    display_name: string;
    search_query: string;
    min_rating: number;
    category_group: string;
    is_city_specific: boolean;
  }[];
  neighborhoodQueries: {
    id: string;
    neighborhood_name: string;
    search_query: string;
    min_rating: number;
    category: string;
  }[];
}

export function CityDetailClient({
  city,
  neighborhoods,
  categories,
  neighborhoodQueries,
}: CityDetailClientProps) {
  const [neighborhoodsList, setNeighborhoodsList] = useState(neighborhoods);
  const [newNeighborhood, setNewNeighborhood] = useState("");
  const [adding, setAdding] = useState(false);

  const addNeighborhood = async () => {
    if (!newNeighborhood.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/admin/cities/${city.id}/neighborhoods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newNeighborhood.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setNeighborhoodsList((p) => [...p, { id: data.id, name: newNeighborhood.trim() }]);
        setNewNeighborhood("");
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{city.name}</h1>
        <p className="text-sm text-muted-foreground">{city.slug}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-muted px-2 py-0.5">lat: {city.center_lat}</span>
          <span className="rounded bg-muted px-2 py-0.5">lng: {city.center_lng}</span>
          <span className="rounded bg-muted px-2 py-0.5">radius: {city.radius_meters}m</span>
          <span className="rounded bg-muted px-2 py-0.5">target: {city.target_venues ?? 150} venues</span>
          <span className="rounded bg-muted px-2 py-0.5">lang: {city.geocode_language}</span>
        </div>
      </div>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold mb-3">Neighborhoods</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {neighborhoodsList.map((n) => (
            <span
              key={n.id}
              className="rounded-full bg-primary/10 px-3 py-1 text-sm"
            >
              {n.name}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newNeighborhood}
            onChange={(e) => setNewNeighborhood(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNeighborhood()}
            placeholder="Add neighborhood"
            className="rounded border px-3 py-1.5 text-sm flex-1 max-w-xs"
          />
          <button
            type="button"
            onClick={addNeighborhood}
            disabled={adding || !newNeighborhood.trim()}
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold mb-3">Categories</h2>
        <div className="space-y-2">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-start justify-between gap-4 rounded border p-3 text-sm"
            >
              <div>
                <span className="font-medium">{c.display_name}</span>
                <span className="text-muted-foreground ml-2">({c.slug})</span>
                <p className="text-muted-foreground mt-0.5">{c.search_query}</p>
                <span className="text-xs text-muted-foreground">
                  min {c.min_rating} · {c.category_group}
                  {c.is_city_specific && " · city-specific"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold mb-3">Neighborhood Queries</h2>
        <div className="space-y-2">
          {neighborhoodQueries.map((nq) => (
            <div
              key={nq.id}
              className="flex items-start justify-between gap-4 rounded border p-3 text-sm"
            >
              <div>
                <span className="font-medium">{nq.neighborhood_name}</span>
                <span className="text-muted-foreground ml-2">→ {nq.category}</span>
                <p className="text-muted-foreground mt-0.5">{nq.search_query}</p>
                <span className="text-xs text-muted-foreground">min {nq.min_rating}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-lg border border-dashed p-4 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          To add categories or neighborhood queries, use the seed script or insert directly into the database. API for full CRUD coming soon.
        </p>
        <code className="mt-2 block text-xs bg-muted px-2 py-1 rounded">
          npx tsx scripts/ingest-places.ts {city.slug} [--incremental]
        </code>
      </div>
    </div>
  );
}

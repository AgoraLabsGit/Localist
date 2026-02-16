"use client";

import { HighlightCard } from "./highlight-card";

// Placeholder data until we connect Supabase
const MOCK_HIGHLIGHTS = [
  {
    id: "1",
    title: "Don Julio",
    short_description: "Legendary Palermo parrilla. Reserve weeks ahead — worth every minute of the wait.",
    category: "parrilla",
    neighborhood: "Palermo",
    avg_expected_price: 35,
    currency: "USD",
    vibe_tags: ["date_night", "local_favorite"],
    rating: 4.8,
    rating_count: 12500,
  },
  {
    id: "2",
    title: "El Ateneo Grand Splendid",
    short_description: "A 1920s theater converted into the world's most beautiful bookstore. Go for the architecture, stay for coffee on the stage.",
    category: "museum",
    neighborhood: "Recoleta",
    avg_expected_price: 0,
    currency: "USD",
    vibe_tags: ["solo_friendly", "touristy", "english_friendly"],
    rating: 4.7,
    rating_count: 43000,
  },
  {
    id: "3",
    title: "Salon Canning",
    short_description: "Authentic milonga in Palermo. Tuesday and Friday nights are the ones to hit.",
    category: "tango_bar",
    neighborhood: "Palermo",
    avg_expected_price: 10,
    currency: "USD",
    vibe_tags: ["local_favorite", "evening"],
    rating: 4.5,
    rating_count: 890,
  },
];

export function HighlightsFeed() {
  return (
    <div className="space-y-3">
      {MOCK_HIGHLIGHTS.map((highlight) => (
        <HighlightCard key={highlight.id} highlight={highlight} />
      ))}
    </div>
  );
}

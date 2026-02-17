"use client";

import { useState } from "react";

export function SkipOnboardingButton() {
  const [loading, setLoading] = useState(false);

  const handleSkip = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home_city: "Buenos Aires",
          primary_neighborhood: null,
          primary_neighborhood_freeform: null,
          preferred_neighborhoods: [],
          persona_type: null,
          weekday_preferences: [],
          weekend_preferences: [],
          interests: ["cafe", "parrilla", "cocktail_bar"],
          vibe_tags_preferred: [],
          budget_band: null,
          acquisition_source: null,
        }),
      });
      if (res.ok) {
        window.location.href = "/";
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSkip}
      disabled={loading}
      className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      {loading ? "Skipping…" : "Skip"}
    </button>
  );
}

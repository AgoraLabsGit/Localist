"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function SkipOnboardingButton() {
  const t = useTranslations("common");
  const [loading, setLoading] = useState(false);

  const handleSkip = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home_city: "Buenos Aires",
          home_neighborhood: null,
          preferred_neighborhoods: [],
          persona_type: "nomad",
          weekly_outing_target: 2,
          preferred_time_blocks: ["weekday_evenings", "weekend_afternoons"],
          typical_group_type: "mixed",
          interests: ["cafe", "parrilla", "cocktail_bar"],
          primary_categories: ["cafe", "parrilla"],
          secondary_categories: ["cocktail_bar"],
          budget_band: "mid",
          vibe_tags_preferred: [],
          touristy_vs_local_preference: "balanced",
          dietary_flags: [],
          alcohol_preference: "okay",
          radius_preference: "few_barrios",
          exploration_style: "balanced",
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
      className="text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 py-2 px-1 -m-1 rounded-lg touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
    >
      {loading ? t("skipping") : t("skip")}
    </button>
  );
}

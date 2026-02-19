"use client";

/**
 * 7-step onboarding flow per ROADMAP Phase 1.2
 * 1. Where you are (city + home + favorites)
 * 2. Who you are (persona)
 * 3. When & how often (weekly outings, time blocks, typical group)
 * 4. What you're into (categories + primary)
 * 5. Budget & vibe
 * 6. Constraints & exploration (optional)
 * 7. Acquisition source
 */
import { useState, useEffect, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { SUPPORTED_CITIES } from "@/lib/cities";
import { useCities, getClosestCity, type SupportedCity } from "@/hooks/use-cities";
import { useNeighborhoods } from "@/hooks/use-neighborhoods";
import { TYPE_GROUPS, formatFilterLabel } from "@/components/filter-sheet";
import { cn } from "@/lib/utils";

const TOTAL_STEPS = 7;

const PERSONA_OPTIONS = [{ id: "local" as const }, { id: "nomad" as const }, { id: "tourist" as const }];
const WEEKLY_OUTING_OPTIONS = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
const TIME_BLOCK_OPTIONS = [
  { id: "weekday_evenings" as const },
  { id: "weekend_afternoons" as const },
  { id: "weekend_evenings" as const },
  { id: "sunday_daytime" as const },
];
const TYPICAL_GROUP_OPTIONS = [{ id: "solo" as const }, { id: "couple" as const }, { id: "friends" as const }, { id: "mixed" as const }];
const VIBE_OPTIONS = [{ id: "solo_friendly" as const }, { id: "group_friendly" as const }, { id: "date_night" as const }, { id: "cozy" as const }, { id: "lively" as const }];
const TOURISTY_VS_LOCAL_OPTIONS = [{ id: "touristy_ok" as const }, { id: "balanced" as const }, { id: "local_only" as const }];
const BUDGET_OPTIONS = [{ id: "cheap" as const }, { id: "mid" as const }, { id: "splurge" as const }];
const DIETARY_OPTIONS = [{ id: "vegetarian" as const }, { id: "vegan" as const }, { id: "gluten_free" as const }];
const ALCOHOL_OPTIONS = [{ id: "okay" as const }, { id: "lowkey" as const }, { id: "avoid" as const }];
const RADIUS_OPTIONS = [{ id: "near_home" as const }, { id: "few_barrios" as const }, { id: "whole_city" as const }];
const EXPLORATION_OPTIONS = [{ id: "favorites" as const }, { id: "balanced" as const }, { id: "adventurous" as const }];
const ACQUISITION_OPTIONS = [
  { id: "instagram_tiktok" as const },
  { id: "friend" as const },
  { id: "whatsapp" as const },
  { id: "search" as const },
  { id: "other" as const },
];

const CATEGORY_OPTIONS = TYPE_GROUPS.flatMap((g) => g.types.map((id) => ({ id, group: g.id })));

function WhereStep({
  homeCity,
  homeNeighborhood,
  preferredNeighborhoods,
  onCityChange,
  onHomeSelect,
  onToggleFavorite,
  onNotSureHome,
  onNext,
  cities,
  neighborhoods,
}: {
  homeCity: string;
  homeNeighborhood: string | null;
  preferredNeighborhoods: string[];
  onCityChange: (city: string) => void;
  onHomeSelect: (n: string | null) => void;
  onToggleFavorite: (n: string) => void;
  onNotSureHome: () => void;
  onNext: () => void;
  cities: SupportedCity[];
  neighborhoods: string[];
}) {
  const tOnb = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const [query, setQuery] = useState(homeCity);
  const [geoLoading, setGeoLoading] = useState(false);
  const onCityChangeRef = useRef(onCityChange);
  onCityChangeRef.current = onCityChange;
  const citiesList = cities.length > 0 ? cities : SUPPORTED_CITIES;

  useEffect(() => {
    setQuery(homeCity);
  }, [homeCity]);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.geolocation || citiesList.length === 0) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const city = getClosestCity(citiesList, pos.coords.latitude, pos.coords.longitude);
        if (city) onCityChangeRef.current(city.name);
        setGeoLoading(false);
      },
      () => {
        if (!cancelled) setGeoLoading(false);
      },
      { enableHighAccuracy: false, timeout: 5000 }
    );
    return () => {
      cancelled = true;
    };
  }, [citiesList.length]);

  const filtered = citiesList.filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  const selectedCity = citiesList.find((c) => c.name === homeCity);

  return (
    <>
      <div>
        <h2 className="text-2xl font-semibold text-center">
          {tOnb("title")}
        </h2>
        <p className="text-muted-foreground text-center mt-2">{tOnb("whereQuestion")}</p>
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">{tOnb("city")}</p>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tOnb("cityPlaceholder")}
            className="w-full rounded-[14px] border border-border-app bg-surface-alt px-4 py-3 text-sm"
          />
          {geoLoading && <p className="text-xs text-muted-foreground mt-1">{tCommon("detecting")}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            {filtered.slice(0, 8).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onCityChange(c.name)}
                className={cn(
                  "text-sm font-medium px-4 py-2 rounded-full",
                  selectedCity?.id === c.id ? "bg-primary text-primary-foreground" : "bg-surface-alt text-muted-foreground hover:bg-surface"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
        {homeCity && (
          <div>
            <p className="text-sm font-medium mb-2">{tOnb("homeNeighborhood")}</p>
            <div className="flex flex-wrap gap-2">
              {neighborhoods.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onHomeSelect(homeNeighborhood === n ? null : n)}
                  className={cn(
                    "text-sm font-medium px-4 py-2 rounded-full",
                    homeNeighborhood === n ? "bg-primary text-primary-foreground" : "bg-surface-alt text-muted-foreground hover:bg-surface"
                  )}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={onNotSureHome}
                className={cn(
                  "text-sm font-medium px-4 py-2 rounded-full",
                  !homeNeighborhood ? "bg-primary text-primary-foreground" : "bg-surface-alt text-muted-foreground hover:bg-surface"
                )}
              >
                {tCommon("notSureYet")}
              </button>
            </div>
          </div>
        )}
        {homeCity && neighborhoods.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">{tOnb("favoriteNeighborhoods")}</p>
            <div className="flex flex-wrap gap-2">
              {neighborhoods.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onToggleFavorite(n)}
                  className={cn(
                    "text-sm font-medium px-4 py-2 rounded-full",
                    preferredNeighborhoods.includes(n) ? "bg-primary text-primary-foreground" : "bg-surface-alt text-muted-foreground hover:bg-surface"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="pt-4">
        <button
          type="button"
          onClick={onNext}
          disabled={!homeCity?.trim()}
          className="w-full rounded-[14px] bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {tOnb("continue")}
        </button>
      </div>
    </>
  );
}

export interface OnboardingData {
  home_city: string;
  home_neighborhood: string | null;
  preferred_neighborhoods: string[];
  persona_type: "local" | "nomad" | "tourist" | null;
  weekly_outing_target: number | null;
  preferred_time_blocks: string[];
  typical_group_type: "solo" | "couple" | "friends" | "mixed" | null;
  interests: string[];
  primary_categories: string[];
  secondary_categories: string[];
  budget_band: "cheap" | "mid" | "splurge" | null;
  vibe_tags_preferred: string[];
  touristy_vs_local_preference: "touristy_ok" | "balanced" | "local_only" | null;
  dietary_flags: string[];
  alcohol_preference: "okay" | "lowkey" | "avoid" | null;
  radius_preference: "near_home" | "few_barrios" | "whole_city" | null;
  exploration_style: "favorites" | "balanced" | "adventurous" | null;
  acquisition_source: string | null;
}

const DEFAULT_DATA: OnboardingData = {
  home_city: "Buenos Aires",
  home_neighborhood: null,
  preferred_neighborhoods: [],
  persona_type: null,
  weekly_outing_target: null,
  preferred_time_blocks: [],
  typical_group_type: null,
  interests: [],
  primary_categories: [],
  secondary_categories: [],
  budget_band: null,
  vibe_tags_preferred: [],
  touristy_vs_local_preference: null,
  dietary_flags: [],
  alcohol_preference: null,
  radius_preference: null,
  exploration_style: null,
  acquisition_source: null,
};

interface OnboardingFlowProps {
  onComplete?: (data: OnboardingData) => Promise<void>;
}

const defaultOnComplete = async (data: OnboardingData) => {
  const res = await fetch("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save");
  window.location.href = "/";
};

export function OnboardingFlow({ onComplete = defaultOnComplete }: OnboardingFlowProps) {
  const tOnb = useTranslations("onboarding");
  const tPlaceTypes = useTranslations("placeTypes");
  const tSettings = useTranslations("settings");
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(DEFAULT_DATA);
  const [saving, setSaving] = useState(false);
  const { cities } = useCities();
  const { neighborhoods } = useNeighborhoods(data.home_city);

  const toggle = (key: keyof OnboardingData, value: string, isArray: boolean) => {
    setData((d) => {
      const current = d[key];
      if (isArray && Array.isArray(current)) {
        const arr = current as string[];
        const removing = arr.includes(value);
        const next = removing ? arr.filter((x) => x !== value) : [...arr, value];
        const updates: Partial<OnboardingData> = { [key]: next };
        // When removing an interest, keep primary ⊂ interests
        if (key === "interests" && removing && d.primary_categories.includes(value)) {
          updates.primary_categories = d.primary_categories.filter((x) => x !== value);
        }
        return { ...d, ...updates };
      }
      return { ...d, [key]: value };
    });
  };

  const setSingle = (key: keyof OnboardingData, value: string | number | null) => {
    setData((d) => ({ ...d, [key]: value }));
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
    else handleFinish();
  };

  const handleSkip = () => {
    if (step === 5) setStep(6); // Skip constraints
    else if (step >= 2) handleFinish(); // Skip from step 3+ goes to finish
  };

  const handleFinish = async () => {
    setSaving(true);
    const preferred_neighborhoods =
      data.preferred_neighborhoods.length > 0
        ? data.preferred_neighborhoods
        : data.home_neighborhood
          ? [data.home_neighborhood]
          : [];
    const interests = data.interests.length > 0 ? data.interests : ["cafe", "parrilla", "cocktail_bar"];
    // primary ⊂ interests; secondary = interests − primary
    const rawPrimary = data.primary_categories.length > 0 ? data.primary_categories : interests.slice(0, 2);
    const primary = rawPrimary.filter((x) => interests.includes(x)).slice(0, 2);
    const secondary = interests.filter((x) => !primary.includes(x));
    await onComplete({
      ...data,
      preferred_neighborhoods,
      interests,
      primary_categories: primary,
      secondary_categories: secondary,
    });
    setSaving(false);
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return !!data.home_city?.trim();
      case 1:
        return !!data.persona_type;
      case 2:
        return data.preferred_time_blocks.length > 0 || data.weekly_outing_target != null;
      case 3:
        return data.interests.length > 0;
      case 4:
      case 5:
      case 6:
        return true;
      default:
        return true;
    }
  };

  return (
    <div className="min-h-[60vh] flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="shrink-0 p-1 -ml-1 text-muted-foreground hover:text-foreground"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        ) : (
          <div className="w-8 shrink-0" />
        )}
        <div className="flex flex-1 justify-center gap-1">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn("h-1 rounded-full flex-1 max-w-8", i <= step ? "bg-primary" : "bg-surface-alt")}
            />
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center mb-2">
        {step + 1} of {TOTAL_STEPS}
      </p>

      <div className="flex-1 space-y-6">
        {step === 0 && (
          <WhereStep
            homeCity={data.home_city}
            homeNeighborhood={data.home_neighborhood}
            preferredNeighborhoods={data.preferred_neighborhoods}
            onCityChange={(city) => setSingle("home_city", city)}
            onHomeSelect={(n) => setSingle("home_neighborhood", n)}
            onToggleFavorite={(n) => toggle("preferred_neighborhoods", n, true)}
            onNotSureHome={() => setSingle("home_neighborhood", null)}
            onNext={handleNext}
            cities={cities}
            neighborhoods={neighborhoods}
          />
        )}

        {step === 1 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">{tOnb("personaStepTitle")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{tOnb("personaStepDesc")}</p>
            </div>
            <div className="space-y-2">
              {PERSONA_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSingle("persona_type", o.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-[14px] border text-sm font-medium",
                    data.persona_type === o.id ? "border-primary bg-primary/10 text-primary" : "border-border-app hover:bg-surface-alt"
                  )}
                >
                  {tOnb(`persona.${o.id}`)}
                </button>
              ))}
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={handleNext}
                disabled={!data.persona_type}
                className="w-full rounded-[14px] bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {tOnb("next")}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">{tOnb("whenStepTitle")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{tOnb("whenStepDesc")}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">{tOnb("weeklyOutingsLabel")}</p>
              <div className="flex flex-wrap gap-2">
                {WEEKLY_OUTING_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSingle("weekly_outing_target", data.weekly_outing_target === o.id ? null : o.id)}
                    className={cn(
                      "text-sm font-medium px-4 py-2 rounded-full",
                      data.weekly_outing_target === o.id ? "bg-primary text-primary-foreground" : "bg-surface-alt text-muted-foreground hover:bg-surface"
                    )}
                  >
                    {tOnb(`weeklyOutings.${o.id}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">{tOnb("whenOutLabel")}</p>
              <div className="flex flex-wrap gap-2">
                {TIME_BLOCK_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle("preferred_time_blocks", o.id, true)}
                    className={cn(
                      "text-sm font-medium px-4 py-2 rounded-full",
                      data.preferred_time_blocks.includes(o.id) ? "bg-primary text-primary-foreground" : "bg-surface-alt text-muted-foreground hover:bg-surface"
                    )}
                  >
                    {tOnb(`timeBlocks.${o.id}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">{tOnb("usuallyWithLabel")}</p>
              <div className="flex flex-wrap gap-2">
                {TYPICAL_GROUP_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSingle("typical_group_type", data.typical_group_type === o.id ? null : o.id)}
                    className={cn(
                      "text-sm font-medium px-4 py-2 rounded-full",
                      data.typical_group_type === o.id ? "bg-primary text-primary-foreground" : "bg-surface-alt text-muted-foreground hover:bg-surface"
                    )}
                  >
                    {tOnb(`typicalGroup.${o.id}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-4 flex gap-2">
              <button
                type="button"
                onClick={handleNext}
                disabled={data.preferred_time_blocks.length === 0 && data.weekly_outing_target == null}
                className="flex-1 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {tOnb("next")}
              </button>
              <button type="button" onClick={handleSkip} className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground">
                {tOnb("skipForNow")}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">{tOnb("interestsStepTitle")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{tOnb("interestsStepDesc")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map((o: { id: string; group: string }) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle("interests", o.id, true)}
                  className={cn(
                    "text-sm font-medium px-4 py-2 rounded-full",
                    data.interests.includes(o.id) ? "bg-primary text-primary-foreground" : "bg-surface-alt text-muted-foreground hover:bg-surface"
                  )}
                >
                  {tPlaceTypes(o.id as any) || formatFilterLabel(o.id)}
                </button>
              ))}
            </div>
            {data.interests.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">{tOnb("pickUpTo2Label")}</p>
                <div className="flex flex-wrap gap-2">
                  {data.interests.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        const inPrimary = data.primary_categories.includes(id);
                        const next = inPrimary
                          ? data.primary_categories.filter((x) => x !== id)
                          : data.primary_categories.length < 2
                            ? [...data.primary_categories, id]
                            : [data.primary_categories[1], id];
                        setData((d) => ({ ...d, primary_categories: next }));
                      }}
                      className={cn(
                        "text-sm font-medium px-4 py-2 rounded-full",
                        data.primary_categories.includes(id) ? "bg-primary text-primary-foreground" : "bg-surface-alt text-muted-foreground hover:bg-surface"
                      )}
                    >
                      {tPlaceTypes.has(id) ? tPlaceTypes(id as any) : formatFilterLabel(id)}
                      {data.primary_categories.includes(id) ? " ★" : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="pt-4">
              <button
                type="button"
                onClick={handleNext}
                disabled={data.interests.length === 0}
                className="w-full rounded-[14px] bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {tOnb("next")}
              </button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">{tOnb("budgetVibeStepTitle")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{tOnb("budgetVibeStepDesc")}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">{tOnb("budgetLabel")}</p>
              <div className="flex flex-wrap gap-2">
                {BUDGET_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSingle("budget_band", data.budget_band === o.id ? null : o.id)}
                    className={cn(
                      "text-sm font-medium px-4 py-2 rounded-full",
                      data.budget_band === o.id ? "bg-primary text-primary-foreground" : "bg-surface-alt text-muted-foreground hover:bg-surface"
                    )}
                  >
                    {tOnb(`budget.${o.id}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">{tOnb("vibesLabel")}</p>
              <div className="flex flex-wrap gap-2">
                {VIBE_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle("vibe_tags_preferred", o.id, true)}
                    className={cn(
                      "text-sm font-medium px-4 py-2 rounded-full",
                      data.vibe_tags_preferred.includes(o.id) ? "bg-primary text-primary-foreground" : "bg-surface-alt text-muted-foreground hover:bg-surface"
                    )}
                  >
                    {tOnb(`vibe.${o.id}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">{tSettings("touristyVsLocalPrefs.title")}</p>
              <div className="flex flex-wrap gap-2">
                {TOURISTY_VS_LOCAL_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSingle("touristy_vs_local_preference", data.touristy_vs_local_preference === o.id ? null : o.id)}
                    className={cn(
                      "text-sm font-medium px-4 py-2 rounded-full",
                      data.touristy_vs_local_preference === o.id ? "bg-primary text-primary-foreground" : "bg-surface-alt text-muted-foreground hover:bg-surface"
                    )}
                  >
                    {tOnb(`touristyVsLocal.${o.id}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={handleNext}
                className="w-full rounded-[14px] bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {tOnb("next")}
              </button>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">{tOnb("constraintsStepTitle")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{tOnb("constraintsStepDesc")}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">{tSettings("constraints.dietary")}</p>
              <div className="flex flex-wrap gap-2">
                {DIETARY_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle("dietary_flags", o.id, true)}
                    className={cn(
                      "text-sm font-medium px-4 py-2 rounded-full",
                      data.dietary_flags.includes(o.id) ? "bg-primary text-primary-foreground" : "bg-surface-alt text-muted-foreground hover:bg-surface"
                    )}
                  >
                    {tSettings(`constraints.${o.id}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">{tSettings("constraints.alcohol")}</p>
              <div className="flex flex-wrap gap-2">
                {ALCOHOL_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSingle("alcohol_preference", data.alcohol_preference === o.id ? null : o.id)}
                    className={cn(
                      "text-sm font-medium px-4 py-2 rounded-full",
                      data.alcohol_preference === o.id ? "bg-primary text-primary-foreground" : "bg-surface-alt text-muted-foreground hover:bg-surface"
                    )}
                  >
                    {tSettings(`constraints.${o.id}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">{tSettings("constraints.howFarToExplore")}</p>
              <div className="flex flex-wrap gap-2">
                {RADIUS_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSingle("radius_preference", data.radius_preference === o.id ? null : o.id)}
                    className={cn(
                      "text-sm font-medium px-4 py-2 rounded-full",
                      data.radius_preference === o.id ? "bg-primary text-primary-foreground" : "bg-surface-alt text-muted-foreground hover:bg-surface"
                    )}
                  >
                    {tOnb(`radius.${o.id}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">{tSettings("constraints.discoverOrStick")}</p>
              <div className="flex flex-wrap gap-2">
                {EXPLORATION_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSingle("exploration_style", data.exploration_style === o.id ? null : o.id)}
                    className={cn(
                      "text-sm font-medium px-4 py-2 rounded-full",
                      data.exploration_style === o.id ? "bg-primary text-primary-foreground" : "bg-surface-alt text-muted-foreground hover:bg-surface"
                    )}
                  >
                    {tOnb(`exploration.${o.id}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-4 flex gap-2">
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {tOnb("next")}
              </button>
              <button type="button" onClick={handleSkip} className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground">
                {tOnb("skip")}
              </button>
            </div>
          </>
        )}

        {step === 6 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">{tOnb("acquisitionStepTitle")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{tOnb("acquisitionStepDesc")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ACQUISITION_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSingle("acquisition_source", o.id)}
                  className={cn(
                    "text-sm font-medium px-4 py-2 rounded-full",
                    data.acquisition_source === o.id ? "bg-primary text-primary-foreground" : "bg-surface-alt text-muted-foreground hover:bg-surface"
                  )}
                >
                  {tOnb(`acquisition.${o.id}`)}
                </button>
              ))}
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={handleFinish}
                disabled={saving}
                className="w-full rounded-[14px] bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? tOnb("settingUp") : tOnb("seeMyPicks")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

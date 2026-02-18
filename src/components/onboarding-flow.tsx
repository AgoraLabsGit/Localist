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
import { SUPPORTED_CITIES } from "@/lib/cities";
import { useCities, getClosestCity, type SupportedCity } from "@/hooks/use-cities";
import { useNeighborhoods } from "@/hooks/use-neighborhoods";
import { TYPE_GROUPS, formatFilterLabel } from "@/components/filter-sheet";
import { cn } from "@/lib/utils";

const TOTAL_STEPS = 7;

const PERSONA_OPTIONS = [
  { id: "local" as const, label: "I live here" },
  { id: "nomad" as const, label: "I'm here long-term (1–6 months)" },
  { id: "tourist" as const, label: "I'm visiting for a trip" },
];

const WEEKLY_OUTING_OPTIONS = [
  { id: 1, label: "0–1 a week" },
  { id: 2, label: "2–3 a week" },
  { id: 3, label: "4–5 a week" },
  { id: 4, label: "6+ a week" },
];

const TIME_BLOCK_OPTIONS = [
  { id: "weekday_evenings", label: "Weekday evenings" },
  { id: "weekend_afternoons", label: "Weekend afternoons" },
  { id: "weekend_evenings", label: "Weekend evenings" },
  { id: "sunday_daytime", label: "Sunday daytime" },
];

const TYPICAL_GROUP_OPTIONS = [
  { id: "solo" as const, label: "Usually solo" },
  { id: "couple" as const, label: "With a partner" },
  { id: "friends" as const, label: "With friends" },
  { id: "mixed" as const, label: "It varies" },
];

const CATEGORY_OPTIONS = TYPE_GROUPS.flatMap((g) =>
  g.types.map((id) => ({ id, label: formatFilterLabel(id), group: g.label }))
);

const VIBE_OPTIONS = [
  { id: "solo_friendly", label: "Solo-friendly" },
  { id: "group_friendly", label: "Group-friendly" },
  { id: "date_night", label: "Date night" },
  { id: "cozy", label: "Cozy" },
  { id: "lively", label: "Lively" },
];

const TOURISTY_VS_LOCAL_OPTIONS = [
  { id: "touristy_ok" as const, label: "Mostly touristy is fine" },
  { id: "balanced" as const, label: "Mix of both" },
  { id: "local_only" as const, label: "Prefer local / off the beaten path" },
];

const BUDGET_OPTIONS = [
  { id: "cheap" as const, label: "Mostly cheap" },
  { id: "mid" as const, label: "Mid-range" },
  { id: "splurge" as const, label: "Happy to splurge sometimes" },
];

const DIETARY_OPTIONS = [
  { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "gluten_free", label: "Gluten-free" },
];

const ALCOHOL_OPTIONS = [
  { id: "okay" as const, label: "I drink" },
  { id: "lowkey" as const, label: "Sometimes / low-key" },
  { id: "avoid" as const, label: "I avoid alcohol" },
];

const RADIUS_OPTIONS = [
  { id: "near_home" as const, label: "Stay near home" },
  { id: "few_barrios" as const, label: "A few neighborhoods" },
  { id: "whole_city" as const, label: "Explore the whole city" },
];

const EXPLORATION_OPTIONS = [
  { id: "favorites" as const, label: "Stick to favorites" },
  { id: "balanced" as const, label: "Mix of both" },
  { id: "adventurous" as const, label: "Always discovering new spots" },
];

const ACQUISITION_OPTIONS = [
  { id: "instagram_tiktok", label: "Instagram / TikTok" },
  { id: "friend", label: "Friend / word of mouth" },
  { id: "whatsapp", label: "WhatsApp / group chat" },
  { id: "search", label: "Search" },
  { id: "other", label: "Other" },
];

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
          Let&apos;s find your city&apos;s best spots
        </h2>
        <p className="text-muted-foreground text-center mt-2">Where are you right now?</p>
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">City</p>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cities…"
            className="w-full rounded-[14px] border border-border-app bg-surface-alt px-4 py-3 text-sm"
          />
          {geoLoading && <p className="text-xs text-muted-foreground mt-1">Detecting…</p>}
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
            <p className="text-sm font-medium mb-2">Which neighborhood do you live in?</p>
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
                Not sure yet
              </button>
            </div>
          </div>
        )}
        {homeCity && neighborhoods.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Favorite neighborhoods to explore? (optional)</p>
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
          Continue
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
              <h2 className="text-lg font-semibold">What best describes you in this city?</h2>
              <p className="text-sm text-muted-foreground mt-1">Helps us tailor suggestions.</p>
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
                  {o.label}
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
                Next
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">When & how often do you go out?</h2>
              <p className="text-sm text-muted-foreground mt-1">We&apos;ll tailor how many picks to show.</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Weekly outings</p>
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
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">When are you most likely to go out?</p>
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
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Usually going out with…</p>
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
                    {o.label}
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
                Next
              </button>
              <button type="button" onClick={handleSkip} className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground">
                Skip for now
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">What are you into?</h2>
              <p className="text-sm text-muted-foreground mt-1">Pick categories you care about.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle("interests", o.id, true)}
                  className={cn(
                    "text-sm font-medium px-4 py-2 rounded-full",
                    data.interests.includes(o.id) ? "bg-primary text-primary-foreground" : "bg-surface-alt text-muted-foreground hover:bg-surface"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {data.interests.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Pick up to 2 that matter most</p>
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
                      {formatFilterLabel(id)}
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
                Next
              </button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">Budget & vibe</h2>
              <p className="text-sm text-muted-foreground mt-1">Fine-tune your picks.</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Budget</p>
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
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Vibes</p>
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
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Touristy vs local?</p>
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
                    {o.label}
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
                Next
              </button>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">Optional: constraints & exploration</h2>
              <p className="text-sm text-muted-foreground mt-1">Change anytime in Settings.</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Dietary</p>
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
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Alcohol</p>
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
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">How far do you like to explore?</p>
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
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Stick to favorites or discover new spots?</p>
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
                    {o.label}
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
                Next
              </button>
              <button type="button" onClick={handleSkip} className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground">
                Skip
              </button>
            </div>
          </>
        )}

        {step === 6 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">How did you hear about us?</h2>
              <p className="text-sm text-muted-foreground mt-1">Helps us reach more people like you.</p>
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
                  {o.label}
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
                {saving ? "Setting up…" : "See my picks"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

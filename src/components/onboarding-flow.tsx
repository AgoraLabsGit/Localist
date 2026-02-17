"use client";

/**
 * Multi-step onboarding flow per docs/CONCIERGE.md
 * Screens 0–7: City → Neighborhood → Persona → Weekday → Weekend → Categories → Fine-tune → Acquisition
 * (Welcome merged with City to reduce taps)
 */
import { useState, useEffect, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { SUPPORTED_CITIES, NEIGHBORHOODS_BY_CITY, getClosestSupportedCity } from "@/lib/cities";
import { cn } from "@/lib/utils";

const PERSONA_OPTIONS = [
  { id: "local" as const, label: "I live here" },
  { id: "nomad" as const, label: "I'm here long-term (1–6 months)" },
  { id: "tourist" as const, label: "I'm visiting for a trip" },
];

const WEEKDAY_OPTIONS = [
  { id: "cafes_work", label: "Cafés to work or read", slugs: ["cafe"] },
  { id: "parks_walks", label: "Parks & walks", slugs: [] },
  { id: "after_work_drinks", label: "After-work drinks", slugs: ["cocktail_bar", "wine_bar", "rooftop"] },
  { id: "quiet_dinners", label: "Quiet dinners", slugs: ["parrilla"] },
  { id: "quick_lunch", label: "Quick lunch spots", slugs: ["parrilla", "heladeria"] },
  { id: "culture", label: "Culture (museums, galleries)", slugs: ["museum"] },
  { id: "gym_fitness", label: "Gym or fitness nearby", slugs: [] },
  { id: "shopping", label: "Shopping or errands", slugs: [] },
];

const WEEKEND_OPTIONS = [
  { id: "bars_nightlife", label: "Bars & nightlife", slugs: ["cocktail_bar", "tango_bar", "jazz_bar"] },
  { id: "live_music", label: "Live music / shows", slugs: ["jazz_bar", "tango_bar"] },
  { id: "food_spots", label: "Food spots & long dinners", slugs: ["parrilla", "brunch", "heladeria"] },
  { id: "brunch", label: "Brunch", slugs: ["brunch", "cafe"] },
  { id: "day_trips", label: "Day trips / exploring neighborhoods", slugs: [] },
  { id: "chill_cafes_parks", label: "Chill cafés & parks", slugs: ["cafe"] },
  { id: "markets", label: "Markets & street food", slugs: [] },
  { id: "sports", label: "Sports or outdoor activities", slugs: [] },
];

const CATEGORY_OPTIONS = [
  { id: "parrilla", label: "Parrillas & steakhouses" },
  { id: "cocktail_bar", label: "Cocktail bars" },
  { id: "wine_bar", label: "Dive bars / local spots" },
  { id: "cafe", label: "Cafés" },
  { id: "tango_bar", label: "Tango & live music" },
  { id: "museum", label: "Museums & culture" },
  { id: "rooftop", label: "Parks & outdoors" },
];

const VIBE_OPTIONS = [
  { id: "solo_friendly", label: "Solo-friendly" },
  { id: "group_friendly", label: "Group-friendly" },
  { id: "date_night", label: "Date night" },
  { id: "lively", label: "Lively" },
  { id: "touristy", label: "Touristy hits" },
  { id: "local", label: "More local / low-key" },
  { id: "hidden_gem", label: "Hidden gems" },
  { id: "local_favorite", label: "Local favorites" },
];

const BUDGET_OPTIONS = [
  { id: "cheap" as const, label: "Mostly cheap" },
  { id: "mid" as const, label: "Mid-range" },
  { id: "splurge" as const, label: "Happy to splurge sometimes" },
];

const ACQUISITION_OPTIONS = [
  { id: "instagram_tiktok", label: "Instagram / TikTok" },
  { id: "friend", label: "Friend / word of mouth" },
  { id: "whatsapp", label: "WhatsApp / group chat" },
  { id: "search", label: "Search" },
  { id: "other", label: "Other" },
];

function CitySelectionStep({
  homeCity,
  onCityChange,
  onNext,
}: {
  homeCity: string;
  onCityChange: (city: string) => void;
  onNext: () => void;
}) {
  const [query, setQuery] = useState(homeCity);
  const [geoLoading, setGeoLoading] = useState(false);
  const onCityChangeRef = useRef(onCityChange);
  onCityChangeRef.current = onCityChange;

  useEffect(() => {
    setQuery(homeCity);
  }, [homeCity]);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const city = getClosestSupportedCity(pos.coords.latitude, pos.coords.longitude);
        if (city) onCityChangeRef.current(city.name);
        setGeoLoading(false);
      },
      () => { if (!cancelled) setGeoLoading(false); },
      { enableHighAccuracy: false, timeout: 5000 }
    );
    return () => { cancelled = true; };
  }, []);

  const filtered = SUPPORTED_CITIES.filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  const selectedCity = SUPPORTED_CITIES.find((c) => c.name === homeCity);

  return (
    <>
      <div>
        <h2 className="text-2xl font-semibold text-center">
          Let&apos;s find your city&apos;s best spots
        </h2>
        <p className="text-muted-foreground text-center mt-2">
          Where are you right now?
        </p>
        <p className="text-xs text-muted-foreground text-center mt-1">
          We&apos;ll use this to tailor your picks in Concierge.
        </p>
      </div>
      <div className="space-y-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cities…"
          className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm"
        />
        {geoLoading && (
          <p className="text-xs text-muted-foreground">Detecting your location…</p>
        )}
        <div className="flex flex-wrap gap-2">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onCityChange(c.name)}
              className={cn(
                "text-sm font-medium px-4 py-2 rounded-full transition-colors",
                selectedCity?.id === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <div className="pt-4">
        <button
          type="button"
          onClick={onNext}
          disabled={!homeCity?.trim()}
          className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </>
  );
}

function NeighborhoodSelectionStep({
  homeCity,
  primaryNeighborhood,
  primaryNeighborhoodFreeform,
  onSelectChip,
  onAnotherNeighborhood,
  onNotSure,
  onNext,
}: {
  homeCity: string;
  primaryNeighborhood: string | null;
  primaryNeighborhoodFreeform: string | null;
  onSelectChip: (n: string) => void;
  onAnotherNeighborhood: (freeform: string | null) => void;
  onNotSure: () => void;
  onNext: () => void;
}) {
  const [showFreeform, setShowFreeform] = useState(!!primaryNeighborhoodFreeform);
  const [freeformValue, setFreeformValue] = useState(primaryNeighborhoodFreeform ?? "");

  const cityId = SUPPORTED_CITIES.find((c) => c.name === homeCity)?.id ?? "buenos-aires";
  const neighborhoods = NEIGHBORHOODS_BY_CITY[cityId] ?? NEIGHBORHOODS_BY_CITY["buenos-aires"] ?? [];

  const handleAnotherSubmit = () => {
    onAnotherNeighborhood(freeformValue.trim() || null);
    setShowFreeform(false);
  };

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold">Which neighborhood are you mostly in?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          We&apos;ll prioritize places near you. Optional.
        </p>
      </div>
      {!showFreeform ? (
        <>
          <div className="flex flex-wrap gap-2">
            {neighborhoods.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onSelectChip(n)}
                className={cn(
                  "text-sm font-medium px-4 py-2 rounded-full transition-colors",
                  primaryNeighborhood === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowFreeform(true)}
              className={cn(
                "text-sm font-medium px-4 py-2 rounded-full border border-dashed transition-colors",
                primaryNeighborhoodFreeform ? "border-primary text-primary" : "border-muted-foreground/50 text-muted-foreground hover:bg-muted/50"
              )}
            >
              Another neighborhood
            </button>
            <button
              type="button"
              onClick={onNotSure}
              className={cn(
                "text-sm font-medium px-4 py-2 rounded-full transition-colors",
                !primaryNeighborhood && !primaryNeighborhoodFreeform ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              I&apos;m not sure yet
            </button>
          </div>
          <div className="pt-4">
            <button
              type="button"
              onClick={onNext}
              className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={freeformValue}
            onChange={(e) => setFreeformValue(e.target.value)}
            placeholder="Type your neighborhood (optional)"
            className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowFreeform(false);
                setFreeformValue("");
                onAnotherNeighborhood(null);
              }}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => { handleAnotherSubmit(); onNext(); }}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export interface OnboardingData {
  home_city: string;
  primary_neighborhood: string | null;
  primary_neighborhood_freeform: string | null;
  preferred_neighborhoods: string[];
  persona_type: "local" | "nomad" | "tourist" | null;
  weekday_preferences: string[];
  weekend_preferences: string[];
  interests: string[];
  vibe_tags_preferred: string[];
  budget_band: "cheap" | "mid" | "splurge" | null;
  acquisition_source: string | null;
}

const DEFAULT_DATA: OnboardingData = {
  home_city: "Buenos Aires",
  primary_neighborhood: null,
  primary_neighborhood_freeform: null,
  preferred_neighborhoods: [],
  persona_type: null,
  weekday_preferences: [],
  weekend_preferences: [],
  interests: [],
  vibe_tags_preferred: [],
  budget_band: null,
  acquisition_source: null,
};

function collectInterestsFromDayPrefs(
  weekday: string[],
  weekend: string[],
  explicitInterests: string[]
): string[] {
  const fromSlugs = new Set<string>();
  for (const w of weekday) {
    const opt = WEEKDAY_OPTIONS.find((o) => o.id === w);
    opt?.slugs.forEach((s) => fromSlugs.add(s));
  }
  for (const w of weekend) {
    const opt = WEEKEND_OPTIONS.find((o) => o.id === w);
    opt?.slugs.forEach((s) => fromSlugs.add(s));
  }
  const merged = new Set([...fromSlugs, ...explicitInterests]);
  return merged.size > 0 ? Array.from(merged) : ["cafe", "parrilla", "cocktail_bar"];
}

interface OnboardingFlowProps {
  /** Called when onboarding completes. Default: POST /api/onboarding then redirect to / */
  onComplete?: (data: OnboardingData) => Promise<void>;
}

const defaultOnComplete: (data: OnboardingData) => Promise<void> = async (data) => {
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

  const totalSteps = 8; // 0–7: City, Neighborhood, Persona, Weekday, Weekend, Categories, Fine-tune, Acquisition
  const progress = step + 1;

  const toggle = (
    key: keyof OnboardingData,
    value: string,
    isArray: boolean
  ) => {
    setData((d) => {
      const current = d[key];
      if (isArray && Array.isArray(current)) {
        const arr = current as string[];
        return {
          ...d,
          [key]: arr.includes(value)
            ? arr.filter((x) => x !== value)
            : [...arr, value],
        };
      }
      return { ...d, [key]: value };
    });
  };

  const setSingle = (key: keyof OnboardingData, value: string | null) => {
    setData((d) => ({ ...d, [key]: value }));
  };

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    if (step === 6) {
      // Fine-tune is skippable — go to Acquisition
      setStep(7);
    } else if (step >= 3) {
      // "Skip for now" from step 3+ (persona done) jumps to feed
      handleFinish();
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    const interests = collectInterestsFromDayPrefs(
      data.weekday_preferences,
      data.weekend_preferences,
      data.interests
    );
    // Only use canonical primary_neighborhood for filtering (not freeform)
    const preferred_neighborhoods = data.primary_neighborhood ? [data.primary_neighborhood] : [];
    await onComplete({
      ...data,
      preferred_neighborhoods,
      interests: interests.length > 0 ? interests : ["cafe", "parrilla", "cocktail_bar"],
    });
    setSaving(false);
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return !!data.home_city?.trim();
      case 1:
        return true; // Neighborhood can be null (I'm not sure)
      case 2:
        return !!data.persona_type;
      case 3:
        return data.weekday_preferences.length > 0;
      case 4:
        return data.weekend_preferences.length > 0;
      case 5:
        return data.interests.length > 0;
      case 6:
        return true; // Optional
      case 7:
        return true;
      default:
        return true;
    }
  };

  return (
    <div className="min-h-[60vh] flex flex-col">
      {/* Back button + Progress */}
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
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 rounded-full flex-1 max-w-8 transition-colors",
                i <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center mb-2">
        {progress} of {totalSteps}
      </p>

      {/* Screen content */}
      <div className="flex-1 space-y-6">
        {step === 0 && (
          <CitySelectionStep
            homeCity={data.home_city}
            onCityChange={(city) => setSingle("home_city", city)}
            onNext={handleNext}
          />
        )}

        {step === 1 && (
          <NeighborhoodSelectionStep
            homeCity={data.home_city}
            primaryNeighborhood={data.primary_neighborhood}
            primaryNeighborhoodFreeform={data.primary_neighborhood_freeform}
            onSelectChip={(n) => {
              setSingle("primary_neighborhood", n);
              setSingle("primary_neighborhood_freeform", null);
            }}
            onAnotherNeighborhood={(freeform) => {
              setSingle("primary_neighborhood", null);
              setSingle("primary_neighborhood_freeform", freeform || null);
            }}
            onNotSure={() => {
              setSingle("primary_neighborhood", null);
              setSingle("primary_neighborhood_freeform", null);
            }}
            onNext={handleNext}
          />
        )}

        {step === 2 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">What best describes you in this city?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Helps us tailor frequency and suggestions.
              </p>
            </div>
            <div className="space-y-2">
              {PERSONA_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSingle("persona_type", o.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-lg border text-sm font-medium transition-colors",
                    data.persona_type === o.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="pt-4 flex gap-2">
              <button
                type="button"
                onClick={handleNext}
                disabled={!data.persona_type}
                className="flex-1 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">
                On weekdays, what are you most in the mood for?
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Pick all that apply.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle("weekday_preferences", o.id, true)}
                  className={cn(
                    "text-sm font-medium px-4 py-2 rounded-full transition-colors",
                    data.weekday_preferences.includes(o.id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="pt-4 flex gap-2">
              <button
                type="button"
                onClick={handleNext}
                disabled={data.weekday_preferences.length === 0}
                className="flex-1 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Next
              </button>
              {step >= 3 && (
                <button
                  type="button"
                  onClick={handleSkip}
                  className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
                >
                  Skip for now
                </button>
              )}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">
                On weekends, what sounds most like you?
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Pick all that apply.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {WEEKEND_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle("weekend_preferences", o.id, true)}
                  className={cn(
                    "text-sm font-medium px-4 py-2 rounded-full transition-colors",
                    data.weekend_preferences.includes(o.id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="pt-4 flex gap-2">
              <button
                type="button"
                onClick={handleNext}
                disabled={data.weekend_preferences.length === 0}
                className="flex-1 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">
                Pick a few things you care most about here
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                We&apos;ll use this to tailor your picks.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle("interests", o.id, true)}
                  className={cn(
                    "text-sm font-medium px-4 py-2 rounded-full transition-colors",
                    data.interests.includes(o.id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="pt-4 flex gap-2">
              <button
                type="button"
                onClick={handleNext}
                disabled={data.interests.length === 0}
                className="flex-1 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        )}

        {step === 6 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">Optional: fine-tune your picks</h2>
              <p className="text-sm text-muted-foreground mt-1">
                You can change this anytime in Settings.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">What kind of places do you prefer?</p>
                <div className="flex flex-wrap gap-2">
                  {VIBE_OPTIONS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggle("vibe_tags_preferred", o.id, true)}
                      className={cn(
                        "text-sm font-medium px-4 py-2 rounded-full transition-colors",
                        data.vibe_tags_preferred.includes(o.id)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">What&apos;s your usual going-out budget?</p>
                <div className="flex flex-wrap gap-2">
                  {BUDGET_OPTIONS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSingle("budget_band", o.id)}
                      className={cn(
                        "text-sm font-medium px-4 py-2 rounded-full transition-colors",
                        data.budget_band === o.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
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
              <button
                type="button"
                onClick={handleSkip}
                className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
              >
                Skip for now
              </button>
            </div>
          </>
        )}

        {step === 7 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">How did you hear about us?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Helps us improve and reach more people like you.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ACQUISITION_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSingle("acquisition_source", o.id)}
                  className={cn(
                    "text-sm font-medium px-4 py-2 rounded-full transition-colors",
                    data.acquisition_source === o.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
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
                className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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

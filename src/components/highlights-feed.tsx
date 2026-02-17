"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { HighlightCard } from "./highlight-card";
import { PlaceDetail } from "./place-detail";
import { TabNav, type Tab } from "./tab-nav";
import { FilterSheet, FilterPill, formatFilterLabel, type FilterState } from "./filter-sheet";
import { ConciergeFilterSheet, type ConciergeFilterState } from "./concierge-filter-sheet";
import type { Highlight } from "@/types/database";
import type { User } from "@supabase/supabase-js";

interface ConciergeSection {
  id: string;
  title: string;
  items: { primary: Highlight; categories: string[]; highlightIds: string[] }[];
}

const PERSONA_LABELS: Record<string, string> = {
  local: "lives here",
  nomad: "here for a while",
  tourist: "visiting",
};

interface Preferences {
  preferred_neighborhoods: string[];
  interests: string[];
  persona_type?: string | null;
  primary_neighborhood?: string | null;
  home_city?: string;
}

interface HighlightsFeedProps {
  highlights: Highlight[];
  initialSavedIds: string[];
  user: User | null;
  preferences?: Preferences;
}

export function HighlightsFeed({ highlights, initialSavedIds, user, preferences = { preferred_neighborhoods: [], interests: [], persona_type: null, primary_neighborhood: null, home_city: "Buenos Aires" } }: HighlightsFeedProps) {
  const [filters, setFilters] = useState<FilterState>({
    category: "all",
    neighborhood: "all",
    vibe: "all",
  });
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [conciergeFilterOpen, setConciergeFilterOpen] = useState(false);
  const [conciergeFilters, setConciergeFilters] = useState<ConciergeFilterState>({
    timeContext: "today",
    radius: "all",
    typeGroup: "all",
  });
  const [conciergeData, setConciergeData] = useState<{
    time_context: string;
    sections: ConciergeSection[];
  } | null>(null);
  const [conciergeLoading, setConciergeLoading] = useState(false);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  const [selectedPlaceSaved, setSelectedPlaceSaved] = useState(false);
  const [selectedToggleSaveId, setSelectedToggleSaveId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(user ? "Concierge" : "Highlights");
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(initialSavedIds));

  const toggleSave = useCallback(async (highlightId: string, currentlySaved: boolean) => {
    if (!user) {
      window.location.href = "/auth/login?next=/";
      return;
    }
    if (currentlySaved) {
      await fetch(`/api/saved?highlightId=${highlightId}`, { method: "DELETE" });
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(highlightId);
        return next;
      });
    } else {
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlightId }),
      });
      if (res.ok) {
        setSavedIds((prev) => new Set(prev).add(highlightId));
      }
    }
  }, [user]);

  /** Merge highlights by venue_id: one card per venue with all categories. */
  const mergedByVenue = useMemo(() => {
    const byVenue = new Map<
      string | null,
      { primary: Highlight; categories: string[]; highlightIds: string[] }
    >();
    for (const h of highlights) {
      const vid = h.venue_id ?? h.id;
      const existing = byVenue.get(vid);
      const cat = h.category;
      if (existing) {
        if (!existing.categories.includes(cat)) existing.categories.push(cat);
        existing.highlightIds.push(h.id);
      } else {
        byVenue.set(vid, { primary: h, categories: [cat], highlightIds: [h.id] });
      }
    }
    return Array.from(byVenue.values());
  }, [highlights]);

  const filtered = useMemo(() => {
    return mergedByVenue.filter(({ primary, categories }) => {
      if (filters.category !== "all" && !categories.includes(filters.category)) return false;
      if (filters.neighborhood === "all") {
        // no neighborhood filter
      } else if (filters.neighborhood === "__yours__") {
        const match = preferences.preferred_neighborhoods?.some(
          (n) => (primary.neighborhood ?? "").toLowerCase() === n.toLowerCase()
        );
        if (!match) return false;
      } else if (primary.neighborhood !== filters.neighborhood) {
        return false;
      }
      if (filters.vibe !== "all") {
        const tags = Array.isArray(primary.vibe_tags) ? primary.vibe_tags : [];
        if (!tags.some((t: string) => String(t).toLowerCase() === filters.vibe.toLowerCase())) return false;
      }
      return true;
    });
  }, [mergedByVenue, filters]);

  const appliedFilterCount = [filters.category, filters.neighborhood, filters.vibe].filter(
    (f) => f !== "all"
  ).length;

  /** Saved: venue is saved if any of its highlights is saved. */
  const savedMerged = useMemo(() => {
    return mergedByVenue.filter(({ highlightIds }) => highlightIds.some((id) => savedIds.has(id)));
  }, [mergedByVenue, savedIds]);

  const getSavedHighlightId = useCallback(
    (highlightIds: string[]) => highlightIds.find((id) => savedIds.has(id)) ?? highlightIds[0],
    [savedIds]
  );

  const conciergeFilterCount = [
    conciergeFilters.timeContext !== "today",
    conciergeFilters.radius !== "all",
    conciergeFilters.typeGroup !== "all",
  ].filter(Boolean).length;

  useEffect(() => {
    if (activeTab !== "Concierge" || !user) return;
    setConciergeLoading(true);
    const params = new URLSearchParams();
    if (conciergeFilters.timeContext !== "today") {
      params.set("timeContext", conciergeFilters.timeContext);
    }
    if (conciergeFilters.radius !== "all") {
      params.set("radius", conciergeFilters.radius);
    }
    if (conciergeFilters.typeGroup !== "all") {
      params.set("typeGroup", conciergeFilters.typeGroup);
    }
    fetch(`/api/concierge?${params}`)
      .then((r) => r.json())
      .then((d) => setConciergeData(d))
      .catch(() => setConciergeData(null))
      .finally(() => setConciergeLoading(false));
  }, [activeTab, user, conciergeFilters]);

  if (highlights.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No highlights yet. Run <code className="bg-muted px-1 rounded">npm run ingest:places</code> to populate.
      </p>
    );
  }

  const displayList = activeTab === "Saved" ? savedMerged : filtered;

  return (
    <div className="space-y-4">
      <TabNav active={activeTab} onTabChange={setActiveTab} />
      {activeTab === "Concierge" && !user && (
        <p className="text-center text-muted-foreground py-8">
          <a href="/auth/login?next=/" className="text-primary hover:underline">
            Sign in
          </a>{" "}
          to get personalized recommendations.
        </p>
      )}
      {activeTab === "Highlights" && (
        <div className="flex items-center justify-between gap-2">
          {/* Single summarizing chip + Clear all */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {appliedFilterCount > 0 ? (
              <>
                <span className="inline-block text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary truncate max-w-full">
                  {[filters.category, filters.neighborhood, filters.vibe]
                    .filter((f) => f !== "all")
                    .map((f) => (f === "__yours__" ? "Your neighborhood" : formatFilterLabel(f)))
                    .join(" · ")}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setFilters({ category: "all", neighborhood: "all", vibe: "all" })
                  }
                  className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </button>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">All places</span>
            )}
          </div>
          <FilterPill onClick={() => setFilterSheetOpen(true)} appliedCount={appliedFilterCount} />
        </div>
      )}
      {activeTab === "Saved" && !user && (
        <p className="text-center text-muted-foreground py-8">
          <a href="/auth/login?next=/" className="text-primary hover:underline">
            Sign in
          </a>{" "}
          to see your saved places.
        </p>
      )}
      {activeTab === "Saved" && user && savedMerged.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No saved places yet. Tap the heart on any place to save it.</p>
      )}
      {activeTab === "Concierge" && user && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Handpicked for {conciergeData?.time_context === "sunday" ? "Sunday" : conciergeData?.time_context === "weekend" ? "the weekend" : "today"} in {preferences.home_city ?? "Buenos Aires"}.
              <a href="/settings" className="text-primary hover:underline ml-1">Adjust</a>
            </p>
            <FilterPill onClick={() => setConciergeFilterOpen(true)} appliedCount={conciergeFilterCount} />
          </div>
          {conciergeLoading && (
            <p className="text-center text-muted-foreground py-8">Loading your picks…</p>
          )}
          {!conciergeLoading && conciergeData?.sections?.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No places match right now. Try changing filters or check Highlights.
            </p>
          )}
          {!conciergeLoading && conciergeData?.sections && conciergeData.sections.length > 0 && (
            <div className="space-y-6">
              {conciergeData.sections.map((section) => (
                <div key={section.id}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">{section.title}</h3>
                  <div className="space-y-3">
                    {section.items.map(({ primary, categories, highlightIds }) => {
                      const savedId = getSavedHighlightId(highlightIds);
                      const isSaved = savedIds.has(savedId);
                      return (
                        <HighlightCard
                          key={primary.venue_id ?? primary.id}
                          highlight={primary}
                          categories={categories}
                          onClick={() => {
                            setSelectedHighlightId(primary.id);
                            setSelectedPlaceSaved(isSaved);
                            setSelectedToggleSaveId(isSaved ? savedId : primary.id);
                          }}
                          saved={isSaved}
                          onToggleSave={(e) => {
                            e?.stopPropagation();
                            toggleSave(isSaved ? savedId : primary.id, isSaved);
                          }}
                          isAuthenticated={!!user}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {(activeTab === "Highlights" || (activeTab === "Saved" && savedMerged.length > 0)) && (
        <div className="space-y-3">
          {displayList.map(({ primary, categories, highlightIds }) => {
            const savedId = getSavedHighlightId(highlightIds);
            const isSaved = savedIds.has(savedId);
            return (
              <HighlightCard
                key={primary.venue_id ?? primary.id}
                highlight={primary}
                categories={categories}
                onClick={() => {
                  setSelectedHighlightId(primary.id);
                  setSelectedPlaceSaved(isSaved);
                  setSelectedToggleSaveId(isSaved ? savedId : primary.id);
                }}
                saved={isSaved}
                onToggleSave={(e) => {
                  e?.stopPropagation();
                  toggleSave(isSaved ? savedId : primary.id, isSaved);
                }}
                isAuthenticated={!!user}
              />
            );
          })}
        </div>
      )}
      <FilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        onApply={() => setFilterSheetOpen(false)}
        resultsCount={filtered.length}
        preferredNeighborhoods={preferences.preferred_neighborhoods}
      />
      <ConciergeFilterSheet
        open={conciergeFilterOpen}
        onClose={() => setConciergeFilterOpen(false)}
        filters={conciergeFilters}
        onFiltersChange={setConciergeFilters}
        onApply={() => setConciergeFilterOpen(false)}
      />
      <PlaceDetail
        highlightId={selectedHighlightId}
        onClose={() => setSelectedHighlightId(null)}
        saved={selectedPlaceSaved}
        onToggleSave={
          selectedHighlightId && selectedToggleSaveId
            ? () => {
                toggleSave(selectedToggleSaveId, selectedPlaceSaved);
                setSelectedPlaceSaved(!selectedPlaceSaved);
              }
            : undefined
        }
        isAuthenticated={!!user}
      />
      {activeTab === "Highlights" && filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-4 text-sm">No places match the selected filters.</p>
      )}
    </div>
  );
}

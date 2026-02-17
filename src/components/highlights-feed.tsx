"use client";

import { useState, useMemo, useCallback } from "react";
import { HighlightCard } from "./highlight-card";
import { PlaceDetail } from "./place-detail";
import { TabNav, type Tab } from "./tab-nav";
import { FilterSheet, FilterPill, formatFilterLabel, type FilterState } from "./filter-sheet";
import type { Highlight } from "@/types/database";
import type { User } from "@supabase/supabase-js";

interface HighlightsFeedProps {
  highlights: Highlight[];
  initialSavedIds: string[];
  user: User | null;
}

export function HighlightsFeed({ highlights, initialSavedIds, user }: HighlightsFeedProps) {
  const [filters, setFilters] = useState<FilterState>({
    category: "all",
    neighborhood: "all",
    vibe: "all",
  });
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  const [selectedPlaceSaved, setSelectedPlaceSaved] = useState(false);
  const [selectedToggleSaveId, setSelectedToggleSaveId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Highlights");
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
      if (filters.neighborhood !== "all" && primary.neighborhood !== filters.neighborhood) return false;
      if (filters.vibe !== "all") {
        const tags = Array.isArray(primary.vibe_tags) ? primary.vibe_tags : [];
        if (!tags.some((t: string) => String(t).toLowerCase() === filters.vibe.toLowerCase())) return false;
      }
      return true;
    });
  }, [mergedByVenue, filters]);

  const appliedFilterCount = [filters.category, filters.neighborhood, filters.vibe].filter((f) => f !== "all").length;

  /** Saved: venue is saved if any of its highlights is saved. */
  const savedMerged = useMemo(() => {
    return mergedByVenue.filter(({ highlightIds }) => highlightIds.some((id) => savedIds.has(id)));
  }, [mergedByVenue, savedIds]);

  const getSavedHighlightId = useCallback(
    (highlightIds: string[]) => highlightIds.find((id) => savedIds.has(id)) ?? highlightIds[0],
    [savedIds]
  );

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
      {activeTab === "Highlights" && (
        <div className="flex items-center justify-between gap-2">
          {/* Single summarizing chip + Clear all */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {appliedFilterCount > 0 ? (
              <>
                <span className="inline-block text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary truncate max-w-full">
                  {[filters.category, filters.neighborhood, filters.vibe]
                    .filter((f) => f !== "all")
                    .map(formatFilterLabel)
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
      {activeTab === "Events" && (
        <p className="text-center text-muted-foreground py-8">Events coming in Phase 2.</p>
      )}
      {activeTab === "Saved" && !user && (
        <p className="text-center text-muted-foreground py-8">
          <a href="/auth/login?next=/" className="text-primary hover:underline">
            Sign in
          </a>{" "}
          to see your saved places.
        </p>
      )}
      {activeTab === "Saved" && user && savedHighlights.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No saved places yet. Tap the heart on any place to save it.</p>
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

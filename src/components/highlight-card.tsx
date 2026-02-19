"use client";

import { Heart, Star, MapPin, UtensilsCrossed, Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Highlight, Venue } from "@/types/database";
import { toTitleCase } from "@/lib/neighborhoods";
import { getPrimaryPhotoUrl } from "@/lib/venue-photo";

function priceLevel(price: number | null): string {
  if (price === null || price === undefined || price === 0) return "";
  if (price < 15) return "$";
  if (price < 40) return "$$";
  return "$$$";
}

function formatCategoryLabel(cat: string, tTypes: (key: string) => string): string {
  if (!cat || typeof cat !== "string") return "";
  try {
    const translated = tTypes(cat);
    if (translated && translated !== cat) return translated;
  } catch {
    // fall through to fallback
  }
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface HighlightCardProps {
  highlight: Highlight;
  categories?: string[];
  onClick?: () => void;
  saved?: boolean;
  isVisited?: boolean;
  rating?: number;
  onToggleSave?: (e?: React.MouseEvent) => void;
  onToggleVisited?: (e?: React.MouseEvent) => void;
  /** Only shown in Concierge: hide/remove this place from feed */
  onHide?: (e?: React.MouseEvent) => void;
  isAuthenticated?: boolean;
}

function getVenue(v: Highlight["venue"]): Venue | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

const ACTION_BTN =
  "inline-flex items-center justify-center size-8 min-w-8 min-h-8 rounded-[12px] border touch-manipulation transition-colors";

export function HighlightCard({
  highlight,
  categories,
  onClick,
  saved = false,
  isVisited = false,
  rating: userRating,
  onToggleSave,
  onToggleVisited,
  onHide,
  isAuthenticated,
}: HighlightCardProps) {
  const tTypes = useTranslations("placeTypes");
  const tPlace = useTranslations("placeDetail");
  const venue = getVenue(highlight.venue);
  const photoUrl = getPrimaryPhotoUrl(venue);
  const rating = venue?.rating ?? null;
  const ratingCount = venue?.rating_count ?? null;
  const vibeTags = Array.isArray(highlight.vibe_tags) ? highlight.vibe_tags : [];
  const price = priceLevel(highlight.avg_expected_price);
  const cats = (categories ?? [highlight.category]).filter((c): c is string => Boolean(c));

  const ratingLabel = (r: number) => {
    if (r >= 4.5) return tPlace("topPick");
    if (r >= 4) return tPlace("strongChoice");
    if (r >= 3) return tPlace("mixed");
    return "";
  };
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      className="rounded-[20px] bg-surface overflow-hidden border border-border-app shadow-card-soft hover:shadow-card-soft hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-200 cursor-pointer text-left active:scale-[0.99]"
    >
      {photoUrl ? (
        <div className="relative aspect-[3/2] w-full overflow-hidden rounded-t-[20px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Bottom gradient for overlay chips readability */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)",
            }}
          />
        </div>
      ) : (
        <div className="aspect-[3/2] w-full bg-surface-alt flex items-center justify-center rounded-t-[20px]">
          <UtensilsCrossed className="w-12 h-12 text-muted-foreground/50" />
        </div>
      )}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Title and rating on one row */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-medium font-display text-foreground">{highlight.title}</h3>
              {rating != null && (
                <div className="flex items-center gap-0.5 text-xs">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="font-medium text-foreground">
                    {rating === 9 && ratingCount == null ? "9+" : rating}
                  </span>
                  {ratingCount != null && ratingCount > 0 && (
                    <span className="text-muted-foreground">({ratingCount.toLocaleString()})</span>
                  )}
                </div>
              )}
            </div>
            {/* Neighborhood and tags on row below */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
                <MapPin className="w-3 h-3" />
                {toTitleCase(highlight.neighborhood ?? highlight.city ?? "")}
              </div>
              {price && (
                <span className="text-[12px] text-muted-foreground">{price}</span>
              )}
              {cats.map((cat) => (
                <span
                  key={cat}
                  className="text-xs font-medium text-chip-foreground px-2 py-1 rounded-[10px] bg-chip"
                >
                  {formatCategoryLabel(cat, (k) => tTypes(k as any))}
                </span>
              ))}
            </div>
            {highlight.short_description && (
              <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
                {highlight.short_description}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 items-center mt-1.5">
              {userRating != null && (
                <span className="inline-flex items-center rounded-[10px] bg-surface-alt px-2 py-1 text-xs text-muted-foreground">
                  ★ {userRating}
                  {ratingLabel(userRating) && ` · ${ratingLabel(userRating)}`}
                </span>
              )}
              {vibeTags.slice(0, 2).map((tag: string) => (
                <span
                  key={tag}
                  className="text-xs text-muted-foreground bg-surface-alt px-2 py-1 rounded-[10px]"
                >
                  {String(tag).replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onToggleSave && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSave(e);
                }}
                className={cn(
                  ACTION_BTN,
                  saved
                    ? "border-red-500/40 bg-red-500/10 text-red-500"
                    : "border-border-medium text-muted-foreground hover:text-red-500 hover:border-red-500/30 active:bg-surface-alt/50"
                )}
                aria-label={saved ? tPlace("unsave") : tPlace("save")}
              >
                <Heart className={cn("w-4 h-4", saved && "fill-red-500")} />
              </button>
            )}
            {onToggleVisited && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisited(e);
                }}
                className={cn(
                  ACTION_BTN,
                  isVisited
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                    : "border-border-medium text-muted-foreground hover:text-emerald-500 hover:border-emerald-500/30 active:bg-surface-alt/50"
                )}
                aria-label={isVisited ? tPlace("unmarkVisited") : tPlace("markVisited")}
              >
                <Check className={cn("w-4 h-4", isVisited && "stroke-[2.5]")} />
              </button>
            )}
            {onHide && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onHide(e);
                }}
                className={cn(
                  ACTION_BTN,
                  "border-border-medium text-muted-foreground hover:text-foreground hover:bg-surface-alt/50"
                )}
                aria-label={tPlace("hide")}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Heart, Star, MapPin } from "lucide-react";
import type { Highlight, Venue } from "@/types/database";

function formatCategory(cat: string) {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function priceLevel(price: number | null): string {
  if (price === null || price === undefined || price === 0) return "";
  if (price < 15) return "$";
  if (price < 40) return "$$";
  return "$$$";
}

interface HighlightCardProps {
  highlight: Highlight;
  categories?: string[];
  onClick?: () => void;
  saved?: boolean;
  onToggleSave?: (e?: React.MouseEvent) => void;
  isAuthenticated?: boolean;
}

function getVenue(v: Highlight["venue"]): Venue | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export function HighlightCard({ highlight, categories, onClick, saved = false, onToggleSave, isAuthenticated }: HighlightCardProps) {
  const venue = getVenue(highlight.venue);
  const rating = venue?.rating ?? null;
  const ratingCount = venue?.rating_count ?? 0;
  const vibeTags = Array.isArray(highlight.vibe_tags) ? highlight.vibe_tags : [];
  const price = priceLevel(highlight.avg_expected_price);
  const cats = categories ?? [highlight.category];
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      className="rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {cats.map((cat) => (
              <span
                key={cat}
                className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full"
              >
                {formatCategory(cat)}
              </span>
            ))}
            {price && (
              <span className="text-xs text-muted-foreground">{price}</span>
            )}
          </div>
          <h3 className="font-semibold text-foreground">{highlight.title}</h3>
          <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            {highlight.neighborhood ?? "Buenos Aires"}
          </div>
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {highlight.short_description ?? ""}
          </p>
          <div className="flex items-center gap-3 mt-2">
            {rating != null && (
              <div className="flex items-center gap-1 text-xs">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{rating}</span>
                <span className="text-muted-foreground">
                  ({ratingCount.toLocaleString()})
                </span>
              </div>
            )}
            <div className="flex gap-1 flex-wrap">
              {vibeTags.slice(0, 2).map((tag: string) => (
                <span
                  key={tag}
                  className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
                >
                  {String(tag).replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        </div>
        <button
          type="button"
          className={saved ? "text-red-500 p-1" : "text-muted-foreground hover:text-red-500 transition-colors p-1"}
          onClick={onToggleSave ?? ((e) => e.stopPropagation())}
          aria-label={saved ? "Unsave" : "Save"}
        >
          <Heart className={`w-5 h-5 ${saved ? "fill-red-500" : ""}`} />
        </button>
      </div>
    </div>
  );
}

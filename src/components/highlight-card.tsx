"use client";

import { Heart, Star, MapPin, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface Highlight {
  id: string;
  title: string;
  short_description: string;
  category: string;
  neighborhood: string;
  avg_expected_price: number;
  currency: string;
  vibe_tags: string[];
  rating: number;
  rating_count: number;
}

function formatCategory(cat: string) {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function priceLevel(price: number): string {
  if (price === 0) return "Free";
  if (price < 15) return "$";
  if (price < 40) return "$$";
  return "$$$";
}

export function HighlightCard({ highlight }: { highlight: Highlight }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {formatCategory(highlight.category)}
            </span>
            <span className="text-xs text-muted-foreground">
              {priceLevel(highlight.avg_expected_price)}
            </span>
          </div>
          <h3 className="font-semibold text-foreground">{highlight.title}</h3>
          <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            {highlight.neighborhood}
          </div>
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {highlight.short_description}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1 text-xs">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{highlight.rating}</span>
              <span className="text-muted-foreground">
                ({highlight.rating_count.toLocaleString()})
              </span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {highlight.vibe_tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
                >
                  {tag.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        </div>
        <button className="text-muted-foreground hover:text-red-500 transition-colors p-1">
          <Heart className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

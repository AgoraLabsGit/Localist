/**
 * Category cards for the Explore surface. Each card routes to the highlights list
 * with pre-applied filters. Includes per-category defaults for Time and Area.
 */
import type { LucideIcon } from "lucide-react";
import {
  Coffee,
  UtensilsCrossed,
  Wine,
  Trees,
  Landmark,
  MapPin,
} from "lucide-react";

export type ExploreTimeFilter = "anytime" | "open_now" | "today" | "tonight" | "weekend";
export type ExploreAreaFilter = "all" | "near_me" | "my_barrios";

export interface ExploreCategory {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  /** Filter category: maps to TYPE_GROUPS id or special value */
  category: string;
  /** Default time filter for this category */
  defaultTime: ExploreTimeFilter;
  /** Default area filter for this category */
  defaultArea: ExploreAreaFilter;
  /** Whether to show vibe chip (bars/restaurants yes, cafés no) */
  showVibeFilter: boolean;
}

export const EXPLORE_CATEGORIES: ExploreCategory[] = [
  {
    id: "cafes",
    title: "Cafés",
    subtitle: "Cafés worth a detour",
    icon: Coffee,
    category: "cafes",
    defaultTime: "today",
    defaultArea: "my_barrios",
    showVibeFilter: false,
  },
  {
    id: "restaurants",
    title: "Restaurants",
    subtitle: "Restaurants that live up to the hype",
    icon: UtensilsCrossed,
    category: "restaurants",
    defaultTime: "today",
    defaultArea: "all",
    showVibeFilter: true,
  },
  {
    id: "bars",
    title: "Bars & Nightlife",
    subtitle: "Bars for great nights",
    icon: Wine,
    category: "bars",
    defaultTime: "tonight",
    defaultArea: "all",
    showVibeFilter: true,
  },
  {
    id: "outdoors",
    title: "Parks & Outdoors",
    subtitle: "Parks that feel special",
    icon: Trees,
    category: "outdoors",
    defaultTime: "weekend",
    defaultArea: "all",
    showVibeFilter: false,
  },
  {
    id: "museums",
    title: "Museums & Culture",
    subtitle: "Culture stops worth the time",
    icon: Landmark,
    category: "museums",
    defaultTime: "anytime",
    defaultArea: "all",
    showVibeFilter: false,
  },
  {
    id: "neighborhoods",
    title: "Neighborhoods",
    subtitle: "Barrios worth exploring",
    icon: MapPin,
    category: "all",
    defaultTime: "anytime",
    defaultArea: "all",
    showVibeFilter: false,
  },
];

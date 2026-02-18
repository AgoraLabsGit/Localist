/**
 * Universal categories — apply to every city.
 * Used by: scripts/config/cities, seed-cities, onboard-city API.
 * Search query format: "best {searchTerm} {cityName}" — each category = Google Text Search call at ingest.
 */

export interface CityCategory {
  query: string;
  category: string;
  isCitySpecific?: boolean;
  minRating?: number;
}

export const UNIVERSAL_CATEGORIES: {
  category: string;
  displayName: string;
  searchTerm: string;
  categoryGroup: "restaurant" | "bar" | "cafe" | "museum" | "other";
  minRating?: number;
}[] = [
  { category: "cafe", displayName: "Cafe", searchTerm: "cafe", categoryGroup: "cafe" },
  { category: "museum", displayName: "Museum", searchTerm: "museum", categoryGroup: "museum" },
  { category: "park", displayName: "Park", searchTerm: "parks", categoryGroup: "other" },
  { category: "theater", displayName: "Theater", searchTerm: "theater", categoryGroup: "other" },
  { category: "music_venue", displayName: "Music Venue", searchTerm: "live music venue", categoryGroup: "bar" },
  { category: "historical_place", displayName: "Historical Place", searchTerm: "historical sites", categoryGroup: "other" },
  { category: "cocktail_bar", displayName: "Cocktail Bar", searchTerm: "cocktail bar", categoryGroup: "bar" },
  { category: "restaurant", displayName: "Restaurant", searchTerm: "restaurant", categoryGroup: "restaurant" },
  { category: "brunch", displayName: "Brunch", searchTerm: "brunch", categoryGroup: "restaurant" },
  { category: "rooftop", displayName: "Rooftop Bar", searchTerm: "rooftop bar", categoryGroup: "bar" },
  { category: "bookstore", displayName: "Bookstore", searchTerm: "bookstore", categoryGroup: "other" },
  { category: "wine_bar", displayName: "Wine Bar", searchTerm: "wine bar", categoryGroup: "bar" },
  { category: "night_club", displayName: "Night Club", searchTerm: "night club", categoryGroup: "bar" },
  { category: "kids_activities", displayName: "Kids Activities", searchTerm: "things to do with kids", categoryGroup: "other" },
  { category: "tours", displayName: "Tours", searchTerm: "tours", categoryGroup: "other" },
  { category: "waterfront", displayName: "Waterfront", searchTerm: "waterfront", categoryGroup: "other" },
  { category: "art_gallery", displayName: "Art Gallery", searchTerm: "art gallery", categoryGroup: "museum" },
];

/** City-specific category slugs → category_group. Single source of truth for seed + onboard. */
const CITY_SPECIFIC_GROUPS: Record<string, "restaurant" | "bar" | "cafe" | "museum" | "other"> = {
  parrilla: "restaurant",
  heladeria: "restaurant",
  pizzeria: "restaurant",
  empanadas: "restaurant",
  panaderia: "restaurant",
  cajun: "restaurant",
  po_boy: "restaurant",
  tango_bar: "bar",
  jazz_bar: "bar",
  fado_bar: "bar",
  cerveceria: "bar",
  dive_bar: "bar",
};

export function getCategoryGroup(slug: string): "restaurant" | "bar" | "cafe" | "museum" | "other" {
  const universal = UNIVERSAL_CATEGORIES.find((u) => u.category === slug);
  if (universal) return universal.categoryGroup;
  return CITY_SPECIFIC_GROUPS[slug] ?? "other";
}

export function expandUniversalCategories(cityName: string): CityCategory[] {
  return UNIVERSAL_CATEGORIES.map((u) => ({
    query: `best ${u.searchTerm} ${cityName}`,
    category: u.category,
    isCitySpecific: false,
    minRating: u.minRating ?? 4.5,
  }));
}

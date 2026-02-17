/**
 * City configs for multi-city ingestion.
 * Each city defines its geography, categories (including city-specific types), and neighborhoods.
 *
 * To add a new city: create a config here, or use the AI onboarding workflow to generate one.
 *
 * Universal categories apply to all cities. City-specific (parrilla, jazz_bar) are added per city.
 * Each category = Google Text Search query "best {term} {city}" — more categories = more API calls per ingest.
 */

import { expandUniversalCategories, UNIVERSAL_CATEGORIES } from "../../src/lib/universal-categories";

export interface CityCategory {
  query: string;
  category: string;
  type?: string; // e.g. "restaurant", "bar" — for future use
  isCitySpecific?: boolean; // e.g. parrilla, tango_bar vs cafe
  minRating?: number; // default 4.5
}

export { UNIVERSAL_CATEGORIES, expandUniversalCategories };

export interface CityConfig {
  id: string;
  name: string;
  center: { lat: number; lng: number };
  radiusMeters: number;
  /** Neighborhoods for address parsing and neighborhood-specific queries. */
  neighborhoods: string[];
  /** City-wide discovery queries — top-rated across the city. 4.5+ stars. */
  categories: CityCategory[];
  /** Neighborhood-specific queries — best-in-area. 4.3+ stars. */
  neighborhoodQueries: { query: string; category: string; neighborhood: string }[];
  /** Geocoding language (e.g. "es" for Buenos Aires, "en" for New Orleans). */
  geocodeLanguage?: string;
  /** Fallback city name when neighborhood cannot be resolved (e.g. "Buenos Aires", "New Orleans"). */
  cityFallbackName?: string; // defaults to name
  /** Target venues for ingestion. Large cities ~250, medium ~150, small ~100. */
  targetVenues?: number;
}

const BUENOS_AIRES_SPECIFIC: CityCategory[] = [
  { query: "best parrilla Buenos Aires", category: "parrilla", isCitySpecific: true },
  { query: "best milonga tango Buenos Aires", category: "tango_bar", isCitySpecific: true },
  { query: "best ice cream Buenos Aires", category: "heladeria", isCitySpecific: true },
];

export const buenosAires: CityConfig = {
  id: "buenos-aires",
  name: "Buenos Aires",
  center: { lat: -34.6037, lng: -58.3816 },
  radiusMeters: 15000,
  neighborhoods: [
    "Palermo", "Recoleta", "San Telmo", "La Boca", "Belgrano",
    "Colegiales", "Nuñez", "Caballito", "Almagro", "Villa Crespo",
    "Retiro", "Puerto Madero", "Monserrat", "San Nicolás", "Balvanera",
    "Boedo", "Barracas", "Constitución", "Flores", "Microcentro",
  ],
  categories: [...expandUniversalCategories("Buenos Aires"), ...BUENOS_AIRES_SPECIFIC],
  neighborhoodQueries: [
    { query: "best parrilla La Boca", category: "parrilla", neighborhood: "La Boca" },
    { query: "best cafe La Boca", category: "cafe", neighborhood: "La Boca" },
    { query: "best parrilla Barracas", category: "parrilla", neighborhood: "Barracas" },
    { query: "best cafe Barracas", category: "cafe", neighborhood: "Barracas" },
    { query: "best parrilla Colegiales", category: "parrilla", neighborhood: "Colegiales" },
    { query: "best cafe Colegiales", category: "cafe", neighborhood: "Colegiales" },
    { query: "best parrilla Constitución", category: "parrilla", neighborhood: "Constitución" },
    { query: "best cafe Flores", category: "cafe", neighborhood: "Flores" },
    { query: "best parrilla Flores", category: "parrilla", neighborhood: "Flores" },
    { query: "best cafe Boedo", category: "cafe", neighborhood: "Boedo" },
    { query: "best parrilla Boedo", category: "parrilla", neighborhood: "Boedo" },
    { query: "best cafe Almagro", category: "cafe", neighborhood: "Almagro" },
    { query: "best parrilla Almagro", category: "parrilla", neighborhood: "Almagro" },
    { query: "best cafe Caballito", category: "cafe", neighborhood: "Caballito" },
    { query: "best parrilla Caballito", category: "parrilla", neighborhood: "Caballito" },
    { query: "best cafe Villa Crespo", category: "cafe", neighborhood: "Villa Crespo" },
    { query: "best parrilla Villa Crespo", category: "parrilla", neighborhood: "Villa Crespo" },
    { query: "best cafe Belgrano", category: "cafe", neighborhood: "Belgrano" },
    { query: "best parrilla Belgrano", category: "parrilla", neighborhood: "Belgrano" },
  ],
  geocodeLanguage: "es",
  targetVenues: 250, // Large city (GBA ~15M)
};

const NEW_ORLEANS_SPECIFIC: CityCategory[] = [
  { query: "best jazz club New Orleans", category: "jazz_bar", isCitySpecific: true },
  { query: "best cajun restaurant New Orleans", category: "cajun", isCitySpecific: true },
  { query: "best po boy New Orleans", category: "po_boy", isCitySpecific: true },
];

export const newOrleans: CityConfig = {
  id: "new-orleans",
  name: "New Orleans",
  center: { lat: 29.9511, lng: -90.0715 },
  radiusMeters: 15000,
  neighborhoods: [
    "French Quarter", "Garden District", "Marigny", "Bywater", "Mid-City",
    "Treme", "Uptown", "Warehouse District", "Faubourg Marigny", "CBD",
  ],
  categories: [...expandUniversalCategories("New Orleans"), ...NEW_ORLEANS_SPECIFIC],
  neighborhoodQueries: [
    { query: "best jazz French Quarter", category: "jazz_bar", neighborhood: "French Quarter" },
    { query: "best cafe French Quarter", category: "cafe", neighborhood: "French Quarter" },
    { query: "best cajun Garden District", category: "cajun", neighborhood: "Garden District" },
    { query: "best cafe Marigny", category: "cafe", neighborhood: "Marigny" },
    { query: "best jazz Marigny", category: "jazz_bar", neighborhood: "Marigny" },
    { query: "best brunch Bywater", category: "brunch", neighborhood: "Bywater" },
    { query: "best cafe Mid-City", category: "cafe", neighborhood: "Mid-City" },
    { query: "best cajun Uptown", category: "cajun", neighborhood: "Uptown" },
  ],
  geocodeLanguage: "en",
  targetVenues: 150, // Medium city
};

const CITIES: Record<string, CityConfig> = {
  "buenos-aires": buenosAires,
  "new-orleans": newOrleans,
};

export function getCityConfig(slug: string): CityConfig | null {
  return CITIES[slug] ?? null;
}

export function listCitySlugs(): string[] {
  return Object.keys(CITIES);
}

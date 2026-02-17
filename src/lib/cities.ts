/**
 * Supported cities for onboarding and filtering.
 * Hard-coded for now; later can load from Supabase cities table.
 */
export interface SupportedCity {
  id: string;
  name: string;
  /** Lat/lng for geolocation distance (Buenos Aires center) */
  center?: { lat: number; lng: number };
}

export const SUPPORTED_CITIES: SupportedCity[] = [
  { id: "buenos-aires", name: "Buenos Aires", center: { lat: -34.6037, lng: -58.3816 } },
];

export const NEIGHBORHOODS_BY_CITY: Record<string, string[]> = {
  "buenos-aires": [
    "Palermo", "Recoleta", "San Telmo", "La Boca", "Belgrano",
    "Villa Crespo", "Puerto Madero", "Microcentro", "Colegiales", "Nuñez",
    "Caballito", "Almagro", "Retiro", "Monserrat", "San Nicolás", "Balvanera",
    "Boedo", "Barracas", "Constitución", "Flores",
  ],
};

/** Validate that a city name is supported. Returns the canonical name or null if unsupported. */
export function validateSupportedCity(name: string): string | null {
  const normalized = name.trim();
  if (!normalized) return null;
  const match = SUPPORTED_CITIES.find(
    (c) => c.name.toLowerCase() === normalized.toLowerCase()
  );
  return match?.name ?? null;
}

/** Resolve city name to id for consistency (e.g. "Buenos Aires" -> "buenos-aires") */
export function cityNameToId(name: string): string | null {
  const normalized = name.trim().toLowerCase();
  const match = SUPPORTED_CITIES.find(
    (c) => c.name.toLowerCase() === normalized || c.id.replace(/-/g, " ") === normalized
  );
  return match?.id ?? null;
}

/** Get city id from name; for storage we use city name in home_city per spec */
export function getClosestSupportedCity(lat: number, lng: number): SupportedCity | null {
  if (SUPPORTED_CITIES.length === 0) return null;
  // For single city, return it
  if (SUPPORTED_CITIES.length === 1) return SUPPORTED_CITIES[0];
  // Simple distance (haversine would be more accurate; fine for 1–2 cities)
  let closest = SUPPORTED_CITIES[0];
  let minDist = Infinity;
  for (const c of SUPPORTED_CITIES) {
    if (!c.center) continue;
    const d = Math.hypot(c.center.lat - lat, c.center.lng - lng);
    if (d < minDist) {
      minDist = d;
      closest = c;
    }
  }
  return closest;
}

export interface UserCityPreference {
  city: string;
  primary_neighborhood: string | null;
  primary_neighborhood_freeform: string | null;
  is_home: boolean;
}

/**
 * Per-categoryGroup Google Places query strategies for discovery optimization.
 * Used by test-google-discovery.ts and (once validated) ingest-places-typed.
 *
 * Decision flow:
 *   1. categoryGroup (cafe, parrilla, bar, ...) → profile
 *   2. profile.patterns = array of { includedType?, textQuery } for tile search
 *   3. Optional: tile position (outer vs central) → different pattern set
 *      - Outer tiles: may use "minimal" (café) if "best-city" underperforms
 *      - Central tiles: may keep "best-city" for known anchors
 *      - Hybrid: run both, merge, dedupe by place_id
 *
 * After cafes converge, run tests for parrilla, bar; update profiles.
 */

export type CategoryGroup = "cafe" | "parrilla" | "bar" | "restaurant" | "museum" | "other";

export interface DiscoveryPattern {
  includedType?: string;
  textQuery: string;
}

export interface DiscoveryProfile {
  id: string;
  description: string;
  patterns: DiscoveryPattern[];
}

/** Locked strategies for controlled experiments. Same set used by test harness. */
export const CAFE_STRATEGIES: { id: string; pattern: DiscoveryPattern; description: string }[] = [
  { id: "best-city", pattern: { includedType: "cafe", textQuery: "best cafe Buenos Aires" }, description: "Current baseline" },
  { id: "city-no-best", pattern: { includedType: "cafe", textQuery: "café Buenos Aires" }, description: "City, no best" },
  { id: "minimal", pattern: { includedType: "cafe", textQuery: "café" }, description: "Minimal: café only" },
  { id: "type-only", pattern: { includedType: "cafe", textQuery: " " }, description: "Type filter only" },
  { id: "text-only", pattern: { textQuery: "café" }, description: "Text only, no type" },
  { id: "neighborhood", pattern: { includedType: "cafe", textQuery: "café Villa Urquiza" }, description: "Neighborhood in query" },
];

/** Anchor cafés in Villa Urquiza tile — used to validate discovery. */
export const CAFE_ANCHORS_VILLA_URQUIZA = [
  "Crisol Villa Urquiza",
  "Chicama",
  "Bilbo Cafe Villa Urquiza",
  "Dorina Café Villa Urquiza",
  "Porta negra",
];

/** Default profile per categoryGroup. Cafe frozen to minimal (test-google-discovery validated). */
export const GOOGLE_DISCOVERY_PROFILES: Record<CategoryGroup, DiscoveryProfile> = {
  cafe: {
    id: "minimal",
    description: "type=cafe + textQuery=café — best main_gate_count in outer tiles",
    patterns: [{ includedType: "cafe", textQuery: "café" }],
  },
  parrilla: {
    id: "parrilla",
    description: "TBD",
    patterns: [{ includedType: "restaurant", textQuery: "best parrilla Buenos Aires" }],
  },
  bar: {
    id: "bar",
    description: "TBD",
    patterns: [{ includedType: "bar", textQuery: "best bar Buenos Aires" }],
  },
  restaurant: {
    id: "restaurant",
    description: "TBD",
    patterns: [{ includedType: "restaurant", textQuery: "best restaurant Buenos Aires" }],
  },
  museum: {
    id: "museum",
    description: "TBD",
    patterns: [{ includedType: "museum", textQuery: "best museum Buenos Aires" }],
  },
  other: {
    id: "other",
    description: "TBD",
    patterns: [{ textQuery: " " }],
  },
};

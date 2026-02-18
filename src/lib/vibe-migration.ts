/**
 * Migration: locality-related vibe tags (touristy, local, hidden_gem, local_favorite)
 * are deprecated. Map them into touristy_vs_local_preference and remove from vibe_tags_preferred.
 */
const LOCALITY_VIBE_IDS = ["touristy", "local", "hidden_gem", "local_favorite"] as const;

/** Strip locality vibes for API responses (read-only; no migration) */
export function stripLocalityVibes(vibes: string[]): string[] {
  const arr = Array.isArray(vibes) ? vibes : [];
  return arr.filter((v) => !LOCALITY_VIBE_IDS.includes(v as (typeof LOCALITY_VIBE_IDS)[number]));
}
const TOURISTY_IDS = ["touristy"] as const;
const LOCAL_IDS = ["local", "hidden_gem", "local_favorite"] as const;

export type TouristVsLocal = "touristy_ok" | "balanced" | "local_only";

export interface VibeMigrationResult {
  /** Social/energy vibes only (locality vibes stripped) */
  vibe_tags_preferred: string[];
  /** If locality vibes were present, inferred value for touristy_vs_local_preference */
  touristy_vs_local_preference?: TouristVsLocal;
}

/**
 * Migrates locality vibes into touristy_vs_local_preference and returns
 * cleaned vibe_tags_preferred (social/energy only).
 */
export function migrateLocalityVibes(vibe_tags_preferred: string[]): VibeMigrationResult {
  const arr = Array.isArray(vibe_tags_preferred) ? vibe_tags_preferred : [];
  const socialVibes = stripLocalityVibes(arr);
  const hasTouristy = arr.some((v) => TOURISTY_IDS.includes(v as (typeof TOURISTY_IDS)[number]));
  const hasLocal = arr.some((v) => LOCAL_IDS.includes(v as (typeof LOCAL_IDS)[number]));

  let touristy_vs_local_preference: TouristVsLocal | undefined;
  if (hasTouristy && hasLocal) {
    touristy_vs_local_preference = "balanced";
  } else if (hasTouristy) {
    touristy_vs_local_preference = "touristy_ok";
  } else if (hasLocal) {
    touristy_vs_local_preference = "local_only";
  }

  const result: VibeMigrationResult = { vibe_tags_preferred: socialVibes };
  if (touristy_vs_local_preference !== undefined) {
    result.touristy_vs_local_preference = touristy_vs_local_preference;
  }
  return result;
}

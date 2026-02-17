/**
 * Admin pipeline settings — loaded from DB, fallback to env.
 * Ingest scripts use loadPipelineSettings() to get caps.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PipelineSettings {
  maxFoursquareCallsPerRun: number | undefined;
  maxGoogleCallsPerRun: number | undefined;
  aiEnrichmentEnabled: boolean;
}

export async function loadPipelineSettings(
  supabase: SupabaseClient
): Promise<PipelineSettings> {
  const { data } = await supabase.from("admin_settings").select("key, value");
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.key, row.value);
  }

  const maxFsqStr = map.get("max_foursquare_calls_per_run") ?? "";
  const maxGoogleStr = map.get("max_google_calls_per_run") ?? "";
  const aiStr = (map.get("ai_enrichment_enabled") ?? "false").toLowerCase();

  const maxFsq = maxFsqStr.trim() === "" ? undefined : parseInt(maxFsqStr, 10);
  const maxGoogle = maxGoogleStr.trim() === "" ? undefined : parseInt(maxGoogleStr, 10);

  return {
    maxFoursquareCallsPerRun: maxFsq != null && !Number.isNaN(maxFsq) ? maxFsq : undefined,
    maxGoogleCallsPerRun: maxGoogle != null && !Number.isNaN(maxGoogle) ? maxGoogle : undefined,
    aiEnrichmentEnabled: aiStr === "true" || aiStr === "1",
  };
}

/** Resolve max FSQ calls: DB settings > env > undefined (no limit) */
export function resolveMaxFoursquareCalls(
  settings: PipelineSettings,
  envMax?: number
): number | undefined {
  return settings.maxFoursquareCallsPerRun ?? envMax ?? undefined;
}

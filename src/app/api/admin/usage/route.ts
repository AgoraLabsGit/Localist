import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";

export interface UsageRun {
  id: string;
  type: "ingest" | "fetch-tips" | "enrich-ai";
  script: string;
  city: string | null;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  items_fetched?: number;
  items_successful?: number;
  items_processed?: number;
  google_calls?: number;
  fsq_calls?: number;
  ai_calls?: number;
  model?: string;
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [ingestionRes, pipelineRes] = await Promise.all([
    supabase
      .from("ingestion_jobs")
      .select("id, source, status, started_at, finished_at, items_fetched, items_successful, run_metadata")
      .order("finished_at", { ascending: false })
      .limit(100),
    supabase
      .from("pipeline_runs")
      .select("id, script, city_slug, status, started_at, finished_at, items_processed, run_metadata")
      .order("finished_at", { ascending: false })
      .limit(100),
  ]);

  if (ingestionRes.error || pipelineRes.error) {
    return NextResponse.json(
      { error: ingestionRes.error?.message ?? pipelineRes.error?.message },
      { status: 500 }
    );
  }

  const ingestion: UsageRun[] = (ingestionRes.data ?? []).map((r) => {
    const meta = (r.run_metadata as Record<string, unknown>) ?? {};
    return {
      id: r.id,
      type: "ingest" as const,
      script: r.source?.startsWith("ingest-places-typed")
        ? "ingest-places-typed"
        : r.source ?? "ingest",
      city: (meta.city_slug as string) ?? null,
      status: r.status ?? "unknown",
      started_at: r.started_at ?? null,
      finished_at: r.finished_at ?? null,
      items_fetched: r.items_fetched ?? undefined,
      items_successful: r.items_successful ?? undefined,
      google_calls: meta.google_calls as number | undefined,
      fsq_calls: meta.fsq_calls as number | undefined,
    };
  });

  const pipeline: UsageRun[] = (pipelineRes.data ?? []).map((r) => {
    const meta = (r.run_metadata as Record<string, unknown>) ?? {};
    return {
      id: r.id,
      type: r.script === "enrich-venues-ai" ? ("enrich-ai" as const) : ("fetch-tips" as const),
      script: r.script ?? "unknown",
      city: r.city_slug ?? null,
      status: r.status ?? "unknown",
      started_at: r.started_at ?? null,
      finished_at: r.finished_at ?? null,
      items_processed: r.items_processed ?? undefined,
      fsq_calls: meta.fsq_calls as number | undefined,
      ai_calls: meta.ai_calls as number | undefined,
      model: meta.model as string | undefined,
    };
  });

  const runs = [...ingestion, ...pipeline].sort((a, b) => {
    const aTime = a.finished_at ?? a.started_at ?? "";
    const bTime = b.finished_at ?? b.started_at ?? "";
    return bTime.localeCompare(aTime);
  });

  return NextResponse.json({ runs });
}

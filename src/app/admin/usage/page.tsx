import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";

export default async function AdminUsagePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/usage");
  if (!(await isAdmin(supabase, user.id))) redirect("/?error=unauthorized");

  const [ingestionRes, pipelineRes, costsRes] = await Promise.all([
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
    supabase.from("api_costs").select("provider, cost_date, cost_usd").order("cost_date", { ascending: false }).limit(90),
  ]);

  const ingestion = ingestionRes.data ?? [];
  const costs = costsRes.data ?? [];
  const pipeline = pipelineRes.data ?? [];

  type RunRow = {
    id: string;
    type: string;
    script: string;
    city: string | null;
    status: string;
    finished: string | null;
    items: string;
    api: string;
  };

  const parseCityFromSource = (source: string | undefined): string | null => {
    if (!source) return null;
    const part = source.split(":").pop();
    if (!part) return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part);
    return isUuid ? null : part;
  };

  const toRunRow = (
    r: { id: string; source?: string; script?: string; city_slug?: string | null; status?: string; finished_at?: string | null; items_fetched?: number; items_successful?: number; items_processed?: number; run_metadata?: unknown },
    type: "ingest" | "fetch" | "ai"
  ): RunRow => {
    const meta = (r.run_metadata as Record<string, unknown>) ?? {};
    let items = "";
    let api = "";

    if (type === "ingest") {
      items = `${r.items_successful ?? "—"} / ${r.items_fetched ?? "—"}`;
      const gc = meta.google_calls as number | undefined;
      const fc = meta.fsq_calls as number | undefined;
      api = [gc != null && `G:${gc}`, fc != null && `F:${fc}`].filter(Boolean).join(" · ") || "—";
    } else if (type === "fetch") {
      items = String(r.items_processed ?? "—");
      const fc = meta.fsq_calls as number | undefined;
      api = fc != null ? `F:${fc}` : "—";
    } else {
      items = String(r.items_processed ?? "—");
      const ac = meta.ai_calls as number | undefined;
      const model = meta.model as string | undefined;
      const mode = meta.mode as string | undefined;
      api = [ac != null && `${ac} calls`, mode ?? model].filter(Boolean).join(" · ") || "—";
    }

    return {
      id: r.id,
      type: type === "ingest" ? "Ingest" : type === "fetch" ? "Fetch tips" : "AI enrich",
      script: r.source ?? r.script ?? "—",
      city: (meta.city_slug as string) ?? r.city_slug ?? parseCityFromSource(r.source ?? r.script),
      status: r.status ?? "—",
      finished: r.finished_at ?? null,
      items,
      api,
    };
  };

  const ingestRows: RunRow[] = ingestion.map((r) =>
    toRunRow(
      {
        ...r,
        source: r.source,
        run_metadata: r.run_metadata,
      },
      "ingest"
    )
  );

  const pipelineRows: RunRow[] = pipeline.map((r) =>
    toRunRow(
      {
        ...r,
        script: r.script,
        city_slug: r.city_slug,
        items_processed: r.items_processed,
        run_metadata: r.run_metadata,
      },
      r.script === "enrich-venues-ai" || r.script === "enrich-venues-ai-web" ? "ai" : "fetch"
    )
  );

  const allRows = [...ingestRows, ...pipelineRows].sort((a, b) => {
    const at = a.finished ?? "";
    const bt = b.finished ?? "";
    return bt.localeCompare(at);
  });

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API & AI Usage</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pipeline runs for cost modeling and records. Ingest = Google + Foursquare. Fetch tips = Foursquare. AI enrich = OpenAI/Claude/Perplexity (tip-rich vs no-tip).
        </p>
      </div>

      {costs.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold mb-2">API costs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4 font-medium">Provider</th>
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 font-medium">Cost (USD)</th>
                </tr>
              </thead>
              <tbody>
                {costs.map((c) => (
                  <tr key={`${c.provider}-${c.cost_date}`} className="border-b last:border-0">
                    <td className="py-2 pr-4 capitalize">{c.provider}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{c.cost_date}</td>
                    <td className="py-2">${Number(c.cost_usd).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            OpenAI: <code className="rounded bg-muted px-1">npm run import:openai-costs</code>. Perplexity (enrich-venues-ai-web), Google, FSQ: <code className="rounded bg-muted px-1">npm run record:api-cost -- perplexity YYYY-MM-DD 0.25</code>
          </p>
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Finished</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">City</th>
                <th className="px-4 py-3 text-left font-medium">Items</th>
                <th className="px-4 py-3 text-left font-medium">API calls (G=Google, F=FSQ)</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {allRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No runs yet. Ingestion and AI scripts log here after migration 042–043.
                  </td>
                </tr>
              ) : (
                allRows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{formatDate(r.finished)}</td>
                    <td className="px-4 py-2">{r.type}</td>
                    <td className="px-4 py-2">{r.city ?? "—"}</td>
                    <td className="px-4 py-2">{r.items}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.api}</td>
                    <td className="px-4 py-2">{r.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Run <code className="rounded bg-muted px-1">supabase db push</code> for migrations 042–044.
        OpenAI: <code className="rounded bg-muted px-1">npm run import:openai-costs</code>. Google/Foursquare: manual from dashboards (no API).
      </p>
    </div>
  );
}

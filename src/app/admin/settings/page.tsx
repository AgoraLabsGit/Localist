import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { AdminSettingsClient } from "./settings-client";

export default async function AdminSettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/settings");
  if (!(await isAdmin(supabase, user.id))) redirect("/?error=unauthorized");

  const { data } = await supabase
    .from("admin_settings")
    .select("key, value, description")
    .in("key", [
      "max_foursquare_calls_per_run",
      "max_google_calls_per_run",
      "ai_enrichment_enabled",
    ]);

  const settings = Object.fromEntries(
    (data ?? []).map((r) => [r.key, r.value])
  );
  const descriptions = Object.fromEntries(
    (data ?? []).map((r) => [r.key, r.description ?? ""])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pipeline Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          API call caps for ingestion. Applied per run. Empty = no limit.
        </p>
      </div>

      <AdminSettingsClient
        initialSettings={settings}
        descriptions={descriptions}
      />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("admin_settings")
    .select("key, value, description")
    .in("key", [
      "max_foursquare_calls_per_run",
      "max_google_calls_per_run",
      "ai_enrichment_enabled",
    ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const settings = Object.fromEntries(
    (data ?? []).map((r) => [r.key, r.value])
  );
  const descriptions = Object.fromEntries(
    (data ?? []).map((r) => [r.key, r.description ?? ""])
  );

  return NextResponse.json({ settings, descriptions });
}

export async function PATCH(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const allowedKeys = [
    "max_foursquare_calls_per_run",
    "max_google_calls_per_run",
    "ai_enrichment_enabled",
  ];

  for (const key of allowedKeys) {
    const val = body[key];
    if (val === undefined) continue;
    const value = typeof val === "boolean" ? String(val) : String(val ?? "").trim();
    await supabase
      .from("admin_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  return NextResponse.json({ ok: true });
}

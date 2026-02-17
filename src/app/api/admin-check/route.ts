/**
 * Debug: verify admin access. GET /api/admin-check when signed in.
 * Returns role status. Remove or restrict in production.
 */
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in", ok: false });
  }
  const email = user.email ?? "";
  const masked = email ? `${email.slice(0, 3)}***@${email.split("@")[1] ?? "?"}` : "(none)";
  const ok = await isAdmin(supabase, user.id);
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  return NextResponse.json({
    ok,
    emailMasked: masked,
    role: profile?.role ?? "(not in users table)",
    hint: !ok
      ? `Run: UPDATE users SET role = 'admin' WHERE email = '${email}';`
      : "You have admin access",
  });
}

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && user) {
      const { data: userRow } = await supabase
        .from("users")
        .select("language")
        .eq("id", user.id)
        .single();
      const locale = userRow?.language && ["en", "es", "pt"].includes(userRow.language) ? userRow.language : "en";
      const res = NextResponse.redirect(`${origin}${next}`);
      res.cookies.set("locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
      return res;
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth`);
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { HighlightsFeed } from "@/components/highlights-feed";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createClient();
  const authRes = await supabase.auth.getUser();
  const user = authRes.data?.user ?? null;

  let activeCity = "Buenos Aires";
  if (user) {
    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("onboarding_completed_at")
      .eq("user_id", user.id)
      .single();
    if (!prefs?.onboarding_completed_at) {
      redirect("/onboarding");
    }
    const { data: userRow } = await supabase.from("users").select("home_city").eq("id", user.id).single();
    activeCity = (userRow?.home_city as string) ?? "Buenos Aires";
  }

  const [highlightsRes, savedIds, preferences] = await Promise.all([
    supabase
      .from("highlights")
      .select("*, venue:venues(*)")
      .eq("status", "active")
      .eq("city", activeCity)
      .order("title"),
    user
      ? supabase
          .from("saved_items")
          .select("target_id")
          .eq("user_id", user.id)
          .eq("target_type", "highlight")
          .then((r) => r.data?.map((x) => x.target_id) ?? [])
      : Promise.resolve([]),
    user
      ? Promise.all([
          supabase.from("user_preferences").select("preferred_neighborhoods, interests, persona_type, primary_neighborhood").eq("user_id", user.id).single(),
          supabase.from("users").select("home_city").eq("id", user.id).single(),
        ]).then(([prefs, userRow]) => ({
          preferred_neighborhoods: (prefs.data?.preferred_neighborhoods as string[]) ?? [],
          interests: (prefs.data?.interests as string[]) ?? [],
          persona_type: (prefs.data?.persona_type as string) ?? null,
          primary_neighborhood: (prefs.data?.primary_neighborhood as string) ?? null,
          home_city: (userRow.data?.home_city as string) ?? "Buenos Aires",
        }))
      : Promise.resolve({ preferred_neighborhoods: [] as string[], interests: [] as string[], persona_type: null, primary_neighborhood: null, home_city: "Buenos Aires" }),
  ]);

  const rawHighlights = highlightsRes.error ? [] : (highlightsRes.data ?? []);
  const highlights = [...rawHighlights].sort((a, b) => {
    const va = Array.isArray(a.venue) ? a.venue[0] : a.venue;
    const vb = Array.isArray(b.venue) ? b.venue[0] : b.venue;
    const sa = va?.quality_score ?? -1;
    const sb = vb?.quality_score ?? -1;
    if (sa !== sb) return sb - sa;
    return (a.title ?? "").localeCompare(b.title ?? "");
  });

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary">Localist</h1>
            <p className="text-xs text-muted-foreground">
              {preferences.home_city ?? "Buenos Aires"}
            </p>
          </div>
          <Link
            href={user ? "/settings" : "/auth/login?next=/"}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            {user ? "Settings" : "Sign in"}
          </Link>
        </div>
      </header>

      {/* Feed (includes TabNav internally) */}
      <div className="max-w-lg mx-auto px-4 py-4">
        <HighlightsFeed
          highlights={highlights}
          initialSavedIds={savedIds}
          user={user}
          preferences={preferences}
        />
      </div>
      <footer className="max-w-lg mx-auto px-4 py-3 text-center">
        <a
          href="https://maps.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Powered by Google Maps
        </a>
      </footer>
    </main>
  );
}

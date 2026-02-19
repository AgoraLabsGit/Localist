import Link from "next/link";

export const dynamic = "force-dynamic"; // Always fetch fresh highlights (AI enrichment, etc.)
import { UserCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HighlightsFeed } from "@/components/highlights-feed";
import { createClient } from "@/lib/supabase/server";
import { getDefaultCityNameFromDb } from "@/lib/cities-db";
import { dedupeAndNormalize } from "@/lib/neighborhoods";

interface HomePageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
}

export default async function Home({ searchParams }: HomePageProps) {
  const t = await getTranslations("common");
  const rawParams = typeof searchParams?.then === "function"
    ? await searchParams
    : (searchParams ?? {});
  const params = rawParams as Record<string, string | string[] | undefined>;
  const category = typeof params?.category === "string" ? params.category : undefined;
  const vibe = typeof params?.vibe === "string" ? params.vibe : undefined;
  const tab = typeof params?.tab === "string" ? params.tab : undefined;
  const supabase = createClient();
  const authRes = await supabase.auth.getUser();
  const user = authRes.data?.user ?? null;

  const defaultCity = await getDefaultCityNameFromDb();
  let activeCity = defaultCity;
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
    activeCity = (userRow?.home_city as string) ?? defaultCity;
  }

  const [highlightsRes, userPlaceState, userPlaceTags, preferences, cityRow] = await Promise.all([
    supabase
      .from("highlights")
      .select("id, title, short_description, vibe_tags, concierge_rationale, category, neighborhood, avg_expected_price, venue_id, city, status, url, venue:venues(*)")
      .eq("status", "active")
      .eq("city", activeCity)
      .order("title"),
    user
      ? supabase
          .from("user_place_state")
          .select("place_id, is_saved, is_visited, rating")
          .eq("user_id", user.id)
          .then((r) => {
            const map: Record<string, { isSaved: boolean; isVisited: boolean; rating?: number }> = {};
            for (const row of r.data ?? []) {
              map[row.place_id] = {
                isSaved: row.is_saved,
                isVisited: row.is_visited,
                rating: row.rating ?? undefined,
              };
            }
            return map;
          })
      : Promise.resolve({} as Record<string, { isSaved: boolean; isVisited: boolean; rating?: number }>),
    user
      ? supabase
          .from("user_place_tags")
          .select("place_id, tag")
          .eq("user_id", user.id)
          .then((r) => {
            const map: Record<string, string[]> = {};
            for (const row of r.data ?? []) {
              const pid = row.place_id;
              if (!map[pid]) map[pid] = [];
              map[pid].push(row.tag);
            }
            return map;
          })
      : Promise.resolve({} as Record<string, string[]>),
    user
      ? Promise.all([
          supabase.from("user_preferences").select("preferred_neighborhoods, interests, persona_type, home_neighborhood").eq("user_id", user.id).single(),
          supabase.from("users").select("home_city").eq("id", user.id).single(),
        ]).then(([prefs, userRow]) => ({
          preferred_neighborhoods: (prefs.data?.preferred_neighborhoods as string[]) ?? [],
          interests: (prefs.data?.interests as string[]) ?? [],
          persona_type: (prefs.data?.persona_type as string) ?? null,
          home_neighborhood: (prefs.data?.home_neighborhood as string) ?? null,
          home_city: (userRow.data?.home_city as string) ?? "Buenos Aires",
        }))
      : Promise.resolve({ preferred_neighborhoods: [] as string[], interests: [] as string[], persona_type: null, home_neighborhood: null, home_city: defaultCity }),
    (async () => {
      const slug = activeCity.toLowerCase().replace(/\s+/g, "-");
      const byName = await supabase.from("cities").select("id").eq("name", activeCity).eq("status", "active").maybeSingle();
      if (byName.data) return byName;
      return supabase.from("cities").select("id").eq("slug", slug).eq("status", "active").maybeSingle();
    })(),
  ]);

  const rawHighlights = highlightsRes.error ? [] : (highlightsRes.data ?? []);
  const fromHighlights = [...new Set(rawHighlights.map((h) => (h as { neighborhood?: string | null }).neighborhood).filter(Boolean))] as string[];
  const fromDb = cityRow?.data
    ? await supabase
        .from("city_neighborhoods")
        .select("name")
        .eq("city_id", cityRow.data.id)
        .order("name")
        .then((r) => (r.data ?? []).map((n) => n.name))
    : [];
  // Only show neighborhoods that have at least one highlight (hide residential / no-places areas)
  const withPlaces = new Set(fromHighlights.map((n) => n.toLowerCase().trim()));
  const filteredDb = fromDb.filter((n) => withPlaces.has(n.toLowerCase().trim()));
  const neighborhoods = dedupeAndNormalize([...filteredDb, ...fromHighlights]);
  const highlights = [...rawHighlights].sort((a, b) => {
    const va = Array.isArray(a.venue) ? a.venue[0] : a.venue;
    const vb = Array.isArray(b.venue) ? b.venue[0] : b.venue;
    const sa = va?.quality_score ?? -1;
    const sb = vb?.quality_score ?? -1;
    if (sa !== sb) return sb - sa;
    return (a.title ?? "").localeCompare(b.title ?? "");
  });

  return (
    <main className="min-h-screen bg-app">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-app border-b border-border-app">
        <div className="max-w-lg mx-auto px-4 py-2.5 grid grid-cols-3 items-center">
          <h1 className="text-lg font-logo text-foreground">Localist</h1>
          <h2 className="text-[15px] sm:text-[17px] font-medium text-foreground text-center tracking-[-0.01em]">
            {preferences.home_city ?? defaultCity}
          </h2>
          <Link
            href={user ? "/settings" : "/auth/login?next=/"}
            className="text-muted-foreground hover:text-foreground justify-self-end p-1.5 -m-1.5 rounded-full transition-colors touch-manipulation"
            aria-label={user ? t("settings") : t("signIn")}
          >
            <UserCircle className="w-6 h-6" strokeWidth={1.5} />
          </Link>
        </div>
      </header>

      {/* Feed (includes TabNav internally) */}
      <div className="max-w-lg mx-auto px-4 py-4 bg-page min-h-[50vh]">
        <HighlightsFeed
          highlights={highlights}
          initialUserStateByPlaceId={userPlaceState}
          initialTagsByPlaceId={userPlaceTags}
          user={user}
          preferences={preferences}
          neighborhoods={neighborhoods}
          initialCategory={category}
          initialVibe={vibe}
          initialTab={tab}
        />
      </div>
      <footer className="max-w-lg mx-auto px-4 py-3 text-center">
        <a
          href="https://maps.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("poweredByGoogleMaps")}
        </a>
      </footer>
    </main>
  );
}

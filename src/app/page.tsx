import Link from "next/link";
import { HighlightsFeed } from "@/components/highlights-feed";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createClient();
  const [highlightsRes, authRes] = await Promise.all([
    supabase
      .from("highlights")
      .select("*, venue:venues(*)")
      .eq("status", "active")
      .order("title"),
    supabase.auth.getUser(),
  ]);

  const highlights = highlightsRes.error ? [] : (highlightsRes.data ?? []);
  const user = authRes.data?.user ?? null;

  const savedIds = user
    ? (await supabase
        .from("saved_items")
        .select("target_id")
        .eq("user_id", user.id)
        .eq("target_type", "highlight"))
        .data?.map((r) => r.target_id) ?? []
    : [];

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary">Localist</h1>
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

import { TabNav } from "@/components/tab-nav";
import { HighlightsFeed } from "@/components/highlights-feed";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary">Localist</h1>
          <button className="text-muted-foreground hover:text-foreground text-sm">
            Settings
          </button>
        </div>
      </header>

      {/* Tabs */}
      <TabNav />

      {/* Feed */}
      <div className="max-w-lg mx-auto px-4 py-4">
        <HighlightsFeed />
      </div>
    </main>
  );
}

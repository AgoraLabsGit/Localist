import Link from "next/link";

const FAVORITES = [
  { id: "playfair", name: "Playfair Display", style: "Serif • Guidebook, curated", variable: "var(--font-playfair)" },
  { id: "comfortaa", name: "Comfortaa", style: "Rounded • Soft, friendly", variable: "var(--font-comfortaa)" },
  { id: "outfit", name: "Outfit", style: "Clean • Contemporary sans", variable: "var(--font-outfit)" },
  { id: "righteous", name: "Righteous", style: "Rounded • Retro, groovy", variable: "var(--font-righteous)" },
  { id: "baloo2", name: "Baloo 2", style: "Rounded • Friendly, kid-friendly", variable: "var(--font-baloo2)" },
  { id: "dancing-script", name: "Dancing Script", style: "Script • Elegant, breezy", variable: "var(--font-dancing-script)" },
] as const;

const BRAND_VIBES = [
  { id: "dm-sans", name: "DM Sans", style: "Stripe-ish • Clean, humanist", variable: "var(--font-dm-sans)" },
  { id: "source-sans-3", name: "Source Sans 3", style: "Stripe-ish • Refined, professional", variable: "var(--font-source-sans-3)" },
  { id: "ibm-plex-sans", name: "IBM Plex Sans", style: "Stripe-ish • Tech, confident", variable: "var(--font-ibm-plex-sans)" },
  { id: "sora", name: "Sora", style: "Stripe-ish • Modern, minimal", variable: "var(--font-sora)" },
  { id: "figtree", name: "Figtree", style: "Pinterest-ish • Friendly, approachable", variable: "var(--font-figtree)" },
  { id: "poppins", name: "Poppins", style: "Pinterest-ish • Geometric, warm", variable: "var(--font-poppins)" },
  { id: "montserrat", name: "Montserrat", style: "Nike-ish • Bold, athletic (use SemiBold)", variable: "var(--font-montserrat)" },
  { id: "anton", name: "Anton", style: "Nike-ish • Condensed, impactful", variable: "var(--font-anton)" },
  { id: "barlow", name: "Barlow", style: "Nike-ish • Condensed variants, editorial", variable: "var(--font-barlow)" },
] as const;

const SCRIPT_FONTS = [
  { id: "dancing-script", name: "Dancing Script", style: "Elegant, breezy", variable: "var(--font-dancing-script)" },
  { id: "pacifico", name: "Pacifico", style: "Casual • Surf, relaxed", variable: "var(--font-pacifico)" },
  { id: "sacramento", name: "Sacramento", style: "Elegant script • Formal", variable: "var(--font-sacramento)" },
  { id: "great-vibes", name: "Great Vibes", style: "Formal script • Calligraphic", variable: "var(--font-great-vibes)" },
  { id: "satisfy", name: "Satisfy", style: "Casual script • Brush", variable: "var(--font-satisfy)" },
  { id: "allura", name: "Allura", style: "Elegant • Flowing", variable: "var(--font-allura)" },
  { id: "kaushan-script", name: "Kaushan Script", style: "Brush script • Bold", variable: "var(--font-kaushan-script)" },
  { id: "caveat", name: "Caveat", style: "Handwritten • Personal", variable: "var(--font-caveat)" },
] as const;

const PLAYFUL_FONTS = [
  { id: "fredoka", name: "Fredoka", style: "Bubbly • Very playful", variable: "var(--font-fredoka)" },
  { id: "varela-round", name: "Varela Round", style: "Rounded • Casual, warm", variable: "var(--font-varela-round)" },
  { id: "lilita-one", name: "Lilita One", style: "Bold • Fun, cartoonish", variable: "var(--font-lilita-one)" },
  { id: "luckiest-guy", name: "Luckiest Guy", style: "Display • Retro, bouncy", variable: "var(--font-luckiest-guy)" },
  { id: "bungee", name: "Bungee", style: "Urban • Bold, street vibe", variable: "var(--font-bungee)" },
  { id: "rubik", name: "Rubik", style: "Rounded corners • Modern playful", variable: "var(--font-rubik)" },
] as const;

export default function FontPreviewPage() {
  return (
    <main className="min-h-screen bg-app">
      <header className="sticky top-0 z-50 bg-app border-b border-border-app">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </Link>
          <h1 className="text-sm font-medium text-muted-foreground">
            Logo font preview
          </h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
        <p className="text-sm text-muted-foreground">
          Pick a font for the &ldquo;Localist&rdquo; wordmark. Delete this page when done.
        </p>

        <section className="space-y-6">
          <h2 className="text-xs font-medium text-foreground uppercase tracking-wider">
            ★ Favorites
          </h2>
          <div className="space-y-4">
            {FAVORITES.map((font) => (
              <div
                key={font.id}
                className="rounded-[14px] border-2 border-[rgba(14,165,233,0.4)] bg-surface p-5"
              >
                <div
                  className={`text-2xl sm:text-3xl text-foreground mb-2 ${["dancing-script"].includes(font.id) ? "font-normal" : "font-semibold tracking-tight"}`}
                  style={{ fontFamily: font.variable }}
                >
                  Localist
                </div>
                <p className="text-xs text-muted-foreground">{font.name}</p>
                <p className="text-xs text-muted-foreground/80 mt-0.5">{font.style}</p>
              </div>
            ))}
          </div>
          <div className="rounded-[14px] border border-border-app bg-surface p-4 mt-4">
            <p className="text-xs text-muted-foreground mb-3">Favorites in header context</p>
            <div className="space-y-3">
              {FAVORITES.map((font) => (
                <div key={font.id} className="flex items-center justify-between">
                  <span
                    className="text-lg font-semibold text-foreground"
                    style={{ fontFamily: font.variable }}
                  >
                    Localist
                  </span>
                  <span className="text-sm text-muted-foreground">Buenos Aires</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Stripe / Pinterest / Nike vibes
          </h2>
          <div className="space-y-8">
            {BRAND_VIBES.map((font) => (
              <div
                key={font.id}
                className="rounded-[14px] border border-border-app bg-surface p-5"
              >
                <div
                  className={`text-2xl sm:text-3xl font-semibold text-foreground tracking-tight mb-2 ${font.id === "anton" ? "uppercase tracking-wider" : ""}`}
                  style={{ fontFamily: font.variable }}
                >
                  Localist
                </div>
                <p className="text-xs text-muted-foreground">{font.name}</p>
                <p className="text-xs text-muted-foreground/80 mt-0.5">{font.style}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            More like Dancing Script (script & cursive)
          </h2>
          <div className="space-y-8">
            {SCRIPT_FONTS.map((font) => (
              <div
                key={font.id}
                className="rounded-[14px] border border-border-app bg-surface p-5"
              >
                <div
                  className="text-2xl sm:text-3xl font-normal text-foreground mb-2"
                  style={{ fontFamily: font.variable }}
                >
                  Localist
                </div>
                <p className="text-xs text-muted-foreground">{font.name}</p>
                <p className="text-xs text-muted-foreground/80 mt-0.5">{font.style}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            More flair & playfulness
          </h2>
          <div className="space-y-8">
            {PLAYFUL_FONTS.map((font) => (
              <div
                key={font.id}
                className="rounded-[14px] border border-border-app bg-surface p-5"
              >
                <div
                  className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight mb-2"
                  style={{ fontFamily: font.variable }}
                >
                  Localist
                </div>
                <p className="text-xs text-muted-foreground">{font.name}</p>
                <p className="text-xs text-muted-foreground/80 mt-0.5">{font.style}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

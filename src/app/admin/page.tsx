import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminCitiesPage() {
  const supabase = createClient();
  const { data: cities, error } = await supabase
    .from("cities")
    .select("id, slug, name, status, center_lat, center_lng, radius_meters")
    .order("slug");

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        Failed to load cities: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cities</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage city configs for ingestion. Add neighborhoods, categories, and discovery queries.
        </p>
      </div>

      {!cities?.length ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <p>No cities yet. Run the seed script:</p>
          <code className="mt-2 block text-left bg-muted px-3 py-2 rounded text-sm">
            npx tsx scripts/seed-cities.ts
          </code>
        </div>
      ) : (
        <div className="space-y-2">
          {cities.map((city) => (
            <Link
              key={city.id}
              href={`/admin/cities/${city.slug}`}
              className="block rounded-lg border bg-card p-4 hover:border-primary/50 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{city.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {city.slug} · {city.radius_meters}m radius · {city.status}
                  </p>
                </div>
                <span className="text-muted-foreground">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

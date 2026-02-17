import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CityDetailClient } from "./city-detail-client";

export default async function AdminCityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createClient();

  const { data: city, error } = await supabase
    .from("cities")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !city) notFound();

  const [
    { data: neighborhoods },
    { data: categories },
    { data: nqWithCat },
  ] = await Promise.all([
    supabase
      .from("city_neighborhoods")
      .select("id, name")
      .eq("city_id", city.id)
      .order("name"),
    supabase
      .from("city_categories")
      .select("id, slug, display_name, search_query, min_rating, category_group, is_city_specific")
      .eq("city_id", city.id)
      .order("slug"),
    supabase
      .from("city_neighborhood_queries")
      .select("id, neighborhood_name, search_query, min_rating, city_categories(slug)")
      .eq("city_id", city.id),
  ]);

  const neighborhoodQueries = (nqWithCat ?? []).map((nq: { id: string; neighborhood_name: string; search_query: string; min_rating: number; city_categories: { slug: string } | null }) => ({
    id: nq.id,
    neighborhood_name: nq.neighborhood_name,
    search_query: nq.search_query,
    min_rating: nq.min_rating,
    category: nq.city_categories?.slug ?? "",
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="text-muted-foreground hover:text-foreground"
        >
          ← Cities
        </Link>
      </div>
      <CityDetailClient
        city={city}
        neighborhoods={neighborhoods ?? []}
        categories={categories ?? []}
        neighborhoodQueries={neighborhoodQueries}
      />
    </div>
  );
}

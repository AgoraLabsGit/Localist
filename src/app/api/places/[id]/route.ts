import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/places/[id]
 * Returns place detail from our DB (Foursquare-sourced address, hours, rating).
 * place_id is used only for "Open in Google Maps" link — we don't call Google API.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing place id" }, { status: 400 });
  }

  const { data: highlight, error: hlError } = await supabase
    .from("highlights")
    .select(`
      id, title, short_description, category,
      venue:venues(
        google_place_id, name, address, opening_hours,
        phone, website_url, latitude, longitude,
        rating, rating_count, photo_urls
      )
    `)
    .eq("id", id)
    .single();

  if (hlError || !highlight) {
    return NextResponse.json({ error: "Place not found" }, { status: 404 });
  }

  const venue = Array.isArray(highlight.venue) ? highlight.venue[0] : highlight.venue;
  const placeId = venue?.google_place_id ?? null;

  // opening_hours stored as JSONB; normalize to string[]
  const hours = venue?.opening_hours;
  const opening_hours = Array.isArray(hours)
    ? hours
    : typeof hours === "string"
      ? [hours]
      : null;

  const photo_urls = Array.isArray(venue?.photo_urls)
    ? venue.photo_urls
    : [];

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://localist.app";
  const shareUrl = `${baseUrl}/buenos-aires/places/${highlight.id}`;

  return NextResponse.json({
    id: highlight.id,
    place_id: placeId,
    share_url: shareUrl,
    name: venue?.name ?? highlight.title,
    lat: venue?.latitude ?? null,
    lng: venue?.longitude ?? null,
    formatted_address: venue?.address ?? null,
    rating: venue?.rating ?? null,
    user_rating_count: venue?.rating_count ?? null,
    opening_hours,
    website: venue?.website_url ?? null,
    phone: venue?.phone ?? null,
    short_description: highlight.short_description ?? null,
    category: highlight.category,
    photo_urls,
  });
}

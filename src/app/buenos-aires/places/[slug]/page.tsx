import Link from "next/link";
import { MapPin, Star, ExternalLink } from "lucide-react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

function buildGoogleMapsUrl(placeId: string, name: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(placeId)}`;
}

function buildAppleMapsUrl(lat: number, lng: number, name: string): string {
  return `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(name)}`;
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createClient();
  const { data: highlight } = await supabase
    .from("highlights")
    .select("title, short_description, venue:venues(photo_urls)")
    .eq("id", slug)
    .single();

  const t = await getTranslations("placeDetail");
  if (!highlight) {
    return { title: t("placeNotFoundTitle") };
  }

  const venue = Array.isArray(highlight.venue) ? highlight.venue[0] : highlight.venue;
  const photoUrls = Array.isArray(venue?.photo_urls) ? venue.photo_urls : [];
  const imageUrl = photoUrls[0] ?? null;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://localist.app";
  const shareUrl = `${baseUrl}/buenos-aires/places/${slug}`;

  return {
    title: `${highlight.title ?? t("placeFallback")} · Localist`,
    description: (highlight.short_description as string) ?? t("smartPicksDescription"),
    openGraph: {
      title: `${highlight.title ?? t("placeFallback")} · Localist`,
      description: (highlight.short_description as string) ?? t("smartPicksDescription"),
      url: shareUrl,
      ...(imageUrl && { images: [{ url: imageUrl }] }),
    },
  };
}

export default async function PublicPlacePage({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations("placeDetail");
  const supabase = createClient();

  const { data: highlight, error } = await supabase
    .from("highlights")
    .select(`
      id, title, short_description, category,
      venue:venues(
        google_place_id, name, address, opening_hours,
        phone, website_url, latitude, longitude,
        rating, rating_count, photo_urls
      )
    `)
    .eq("id", slug)
    .eq("status", "active")
    .single();

  if (error || !highlight) {
    notFound();
  }

  const venue = Array.isArray(highlight.venue) ? highlight.venue[0] : highlight.venue;
  const name = (venue as { name?: string })?.name ?? highlight.title;
  const placeId = (venue as { google_place_id?: string | null })?.google_place_id ?? null;
  const lat = (venue as { latitude?: number | null })?.latitude ?? null;
  const lng = (venue as { longitude?: number | null })?.longitude ?? null;
  const address = (venue as { address?: string | null })?.address ?? null;
  const rating = (venue as { rating?: number | null })?.rating ?? null;
  const ratingCount = (venue as { rating_count?: number | null })?.rating_count ?? null;
  const website = (venue as { website_url?: string | null })?.website_url ?? null;
  const photoUrls = Array.isArray((venue as { photo_urls?: string[] })?.photo_urls)
    ? (venue as { photo_urls: string[] }).photo_urls
    : [];

  const googleMapsUrl = placeId ? buildGoogleMapsUrl(placeId, name) : null;
  const appleMapsUrl = lat != null && lng != null ? buildAppleMapsUrl(lat, lng, name) : null;

  return (
    <div className="min-h-screen bg-surface text-foreground">
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Hero image */}
        {photoUrls[0] && (
          <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[20px] mb-6">
            <img
              src={photoUrls[0]}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Title + rating */}
        <h1 className="text-2xl font-semibold font-display">{name}</h1>
        {rating != null && (
          <div className="flex items-center gap-1.5 mt-1">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span className="text-sm font-medium">{rating}</span>
            {ratingCount != null && (
              <span className="text-xs text-muted-foreground">
                ({ratingCount.toLocaleString()} {t("reviews")})
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1 px-3 h-[32px] rounded-[10px] text-[14px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <MapPin className="w-3 h-3" />
              {t("googleMaps")}
            </a>
          )}
          {appleMapsUrl && (
            <a
              href={appleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1 px-3 h-[32px] rounded-[10px] text-[14px] font-medium border border-border-medium bg-transparent text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="w-3 h-3" />
              {t("appleMaps")}
            </a>
          )}
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1 px-3 h-[32px] rounded-[10px] text-[14px] font-medium border border-border-medium bg-transparent text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="w-3 h-3" />
              {t("website")}
            </a>
          )}
        </div>

        {address && (
          <p className="mt-3 text-sm text-muted-foreground">{address}</p>
        )}

        {(highlight.short_description as string) && (
          <p className="mt-3 text-sm text-muted-foreground">
            {highlight.short_description as string}
          </p>
        )}

        {/* CTA: Open in Localist */}
        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center w-full py-3 rounded-[14px] bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          {t("openInLocalist")}
        </Link>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("smartPicksFooter")}
        </p>
      </div>
    </div>
  );
}

import type { Venue } from "@/types/database";

/** Build Foursquare photo URL from prefix+suffix (e.g. 600x400) */
export function getVenuePhotoUrl(venue: Venue | null, size = "600x400"): string | null {
  if (!venue?.fsq_photo_prefix || !venue?.fsq_photo_suffix) return null;
  return `${venue.fsq_photo_prefix}${size}${venue.fsq_photo_suffix}`;
}

/** First photo from photo_urls JSONB, or fsq photo, or null */
export function getPrimaryPhotoUrl(venue: Venue | null): string | null {
  if (!venue) return null;
  const fsq = getVenuePhotoUrl(venue);
  if (fsq) return fsq;
  const urls = venue.photo_urls;
  if (Array.isArray(urls) && urls.length > 0) return urls[0] as string;
  return null;
}

"use client";

import { useEffect, useState } from "react";
import { X, MapPin, Star, Clock, ExternalLink, Heart } from "lucide-react";

export interface PlaceDetailData {
  id: string;
  place_id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  formatted_address: string | null;
  rating: number | null;
  user_rating_count: number | null;
  opening_hours: string[] | null;
  website: string | null;
  phone: string | null;
  short_description: string | null;
  category: string;
  photo_urls?: string[];
}

interface PlaceDetailProps {
  highlightId: string | null;
  onClose: () => void;
  saved?: boolean;
  onToggleSave?: () => void;
  isAuthenticated?: boolean;
}

function buildGoogleMapsUrl(placeId: string, name: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(placeId)}`;
}

function buildAppleMapsUrl(lat: number, lng: number, name: string): string {
  return `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(name)}`;
}

function isAppleDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod|Macintosh|Mac OS/.test(ua);
}

export function PlaceDetail({ highlightId, onClose, saved = false, onToggleSave, isAuthenticated }: PlaceDetailProps) {
  const [data, setData] = useState<PlaceDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/places/${highlightId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load place");
        return res.json();
      })
      .then(setData)
      .catch(() => setError("Could not load place details"))
      .finally(() => setLoading(false));
  }, [highlightId]);

  if (!highlightId) return null;

  const canOpenGoogleMaps = data?.place_id && data?.name;
  const canOpenAppleMaps = data && data.lat != null && data.lng != null;
  const googleMapsUrl = canOpenGoogleMaps ? buildGoogleMapsUrl(data.place_id!, data.name!) : null;
  const appleMapsUrl = canOpenAppleMaps ? buildAppleMapsUrl(data!.lat!, data!.lng!, data!.name) : null;
  const showAppleMaps = isAppleDevice();

  const openUrl = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    // Later with Capacitor: import { Browser } from '@capacitor/browser'; Browser.open({ url });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Drawer/Modal */}
      <div
        className="relative w-full max-w-lg max-h-[90vh] bg-background rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-detail-title"
      >
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-background border-b">
            <h2 id="place-detail-title" className="text-lg font-semibold truncate pr-2">
              {data?.name ?? "Place Details"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 -m-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {loading && (
              <div className="py-12 text-center text-muted-foreground">Loading…</div>
            )}
            {error && (
              <div className="py-12 text-center text-destructive">{error}</div>
            )}
            {data && !loading && (
              <>
                {/* Open in Maps buttons */}
                <div className="flex flex-col sm:flex-row gap-2">
                  {googleMapsUrl && (
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.preventDefault();
                        openUrl(googleMapsUrl);
                      }}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                    >
                      <MapPin className="w-4 h-4" />
                      Open in Google Maps
                    </a>
                  )}
                  {showAppleMaps && appleMapsUrl && (
                    <a
                      href={appleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.preventDefault();
                        openUrl(appleMapsUrl!);
                      }}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border bg-background font-medium hover:bg-muted transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in Apple Maps
                    </a>
                  )}
                </div>

                {/* Save button */}
                {onToggleSave && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!isAuthenticated) {
                        window.location.href = "/auth/login?next=/";
                        return;
                      }
                      onToggleSave();
                    }}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border font-medium transition-colors ${
                      saved ? "bg-red-500/10 text-red-500 border-red-500/30" : "bg-background hover:bg-muted"
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${saved ? "fill-red-500" : ""}`} />
                    {saved ? "Saved" : "Save"}
                  </button>
                )}

                {/* Data attribution */}
                <p className="text-xs text-muted-foreground">
                  Address & hours from{" "}
                  <a
                    href="https://foursquare.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Foursquare
                  </a>
                  {" · "}
                  <a
                    href="https://maps.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Open in Google Maps
                  </a>
                </p>

                {data.photo_urls && data.photo_urls.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2">
                    {data.photo_urls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="h-40 w-auto rounded-lg object-cover shrink-0"
                      />
                    ))}
                  </div>
                )}

                {data.short_description && (
                  <p className="text-sm text-muted-foreground">{data.short_description}</p>
                )}

                {data.formatted_address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
                    <span>{data.formatted_address}</span>
                  </div>
                )}

                {(data.rating != null || data.user_rating_count != null) && (
                  <div className="flex items-center gap-2 text-sm">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{data.rating}</span>
                    {data.user_rating_count != null && (
                      <span className="text-muted-foreground">
                        ({data.user_rating_count.toLocaleString()} reviews)
                      </span>
                    )}
                  </div>
                )}

                {data.opening_hours && data.opening_hours.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="w-4 h-4" />
                      Hours
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-0.5 pl-6">
                      {data.opening_hours.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.phone && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Phone: </span>
                    <a href={`tel:${data.phone}`} className="hover:underline">
                      {data.phone}
                    </a>
                  </div>
                )}

                {data.website && (
                  <a
                    href={data.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Visit website
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { X, MapPin, Star, Clock, ExternalLink, Heart, Check, Copy, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Parsed hours row: day label + time range, with today flag for accent */
interface HoursRow {
  dayLabel: string;
  timeRange: string;
  isToday: boolean;
}

const DAY_TO_NUM: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function parseOpeningHours(lines: string[]): HoursRow[] {
  const today = new Date().getDay(); // 0=Sun..6=Sat
  const rows: HoursRow[] = [];
  const singleDays: { dayNum: number; dayName: string; timeRange: string }[] = [];

  // Flatten: split semicolon-separated display format ("Mon-Wed 7PM; Thu 7PM; ...")
  const segments = lines.flatMap((l) => l.split(";").map((s) => s.trim()).filter(Boolean));

  for (const trimmed of segments) {

    // Match "Mon: 9AM-5PM" or "Mon – Wed: 9AM-5PM"
    const colonMatch = trimmed.match(/^([A-Za-z]{3})(?:\s*[–\-]\s*([A-Za-z]{3}))?\s*:\s*(.+)$/);
    if (colonMatch) {
      const startDay = colonMatch[1];
      const endDay = colonMatch[2];
      const timeRange = colonMatch[3].replace(/\s*-\s*|\s*–\s*/g, "–").trim();
      if (!endDay) {
        const dayNum = DAY_TO_NUM[startDay];
        if (dayNum != null) singleDays.push({ dayNum, dayName: startDay, timeRange });
        continue;
      }
      const startNum = DAY_TO_NUM[startDay] ?? -1;
      const endNum = DAY_TO_NUM[endDay] ?? startNum;
      const dayLabel = `${startDay}–${endDay}`;
      const isToday = startNum <= today && today <= endNum;
      rows.push({ dayLabel, timeRange, isToday });
      continue;
    }

    // Match "Mon-Wed 9AM-5PM" or "Mon–Fri · 7:00 PM–2:00 AM" (no colon)
    const dashMatch = trimmed.match(/^([A-Za-z]{3})\s*[–\-]\s*([A-Za-z]{3})\s*[·\-\s]+\s*(.+)$/);
    if (dashMatch) {
      const dayLabel = `${dashMatch[1]}–${dashMatch[2]}`;
      const timeRange = dashMatch[3].replace(/\s*-\s*|\s*–\s*/g, "–").trim();
      const startNum = DAY_TO_NUM[dashMatch[1]] ?? -1;
      const endNum = DAY_TO_NUM[dashMatch[2]] ?? -1;
      const isToday = startNum <= today && today <= endNum;
      rows.push({ dayLabel, timeRange, isToday });
      continue;
    }

    // Single day "Mon 9AM-5PM"
    const singleMatch = trimmed.match(/^([A-Za-z]{3})\s+(.+)$/);
    if (singleMatch && DAY_TO_NUM[singleMatch[1]] != null) {
      const dayLabel = singleMatch[1];
      const timeRange = singleMatch[2].replace(/\s*-\s*|\s*–\s*/g, "–").trim();
      rows.push({ dayLabel, timeRange, isToday: DAY_TO_NUM[dayLabel] === today });
      continue;
    }

    // Fallback: treat as time-only (e.g. "9AM-5PM"), label as "Hours"
    rows.push({ dayLabel: "Hours", timeRange: trimmed.replace(/\s*-\s*|\s*–\s*/g, "–").trim(), isToday: true });
  }

  // Group consecutive single-day entries with same time (e.g. Mon, Tue, Wed → Mon–Wed)
  if (singleDays.length > 0) {
    const sorted = [...singleDays].sort((a, b) => a.dayNum - b.dayNum);
    let i = 0;
    while (i < sorted.length) {
      const start = sorted[i];
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1].timeRange === start.timeRange) j++;
      const end = sorted[j];
      const dayLabel = start.dayName === end.dayName ? start.dayName : `${start.dayName}–${end.dayName}`;
      const isToday = start.dayNum <= today && today <= end.dayNum;
      rows.push({ dayLabel, timeRange: start.timeRange, isToday });
      i = j + 1;
    }
  }

  return rows;
}

/** Icon buttons — 32×32, dimmed outline so primary (Google Maps) stands out */
const ACTION_BTN =
  "inline-flex items-center justify-center size-[32px] min-w-[32px] min-h-[32px] rounded-[10px] border border-[rgba(148,163,184,0.25)] touch-manipulation transition-colors";

export interface PlaceDetailData {
  id: string;
  place_id: string;
  share_url: string | null;
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
  isVisited?: boolean;
  rating?: number;
  userTags?: string[];
  onToggleSave?: () => void;
  onVisitedChange?: (visited: boolean) => void;
  onRatingChange?: (rating: number) => void;
  onTagsChange?: (tags: string[]) => void;
  /** When provided, shows reject (X) button — e.g. "Not this one" from Concierge */
  onReject?: () => void;
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

/** Normalize Argentine phone to E.164 for tel/WhatsApp links */
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("54")) return `+${digits}`;
  const local = digits.startsWith("0") ? digits.slice(1) : digits;
  if (local.length >= 9 && local.length <= 11) return `+54${local}`;
  return `+${digits}`;
}

export function PlaceDetail({
  highlightId,
  onClose,
  saved = false,
  isVisited = false,
  rating: initialRating = 0,
  userTags: initialTags = [],
  onToggleSave,
  onVisitedChange,
  onRatingChange,
  onTagsChange,
  onReject,
  isAuthenticated,
}: PlaceDetailProps) {
  const [data, setData] = useState<PlaceDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localVisited, setLocalVisited] = useState(isVisited);
  const [localRating, setLocalRating] = useState(initialRating);
  const [localTags, setLocalTags] = useState<string[]>(initialTags);
  const [tagInputOpen, setTagInputOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [copyToast, setCopyToast] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  useEffect(() => {
    setLocalVisited(isVisited);
    setLocalRating(initialRating);
    setLocalTags(initialTags);
  }, [highlightId, isVisited, initialRating, initialTags]);


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

  useEffect(() => {
    if (!highlightId || !isAuthenticated) return;
    fetch(`/api/user-place-context?placeId=${highlightId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((ctx) => {
        if (ctx) {
          setLocalVisited(ctx.userState?.isVisited ?? false);
          setLocalRating(ctx.userState?.rating ?? 0);
          setLocalTags(ctx.userTags ?? []);
        }
      })
      .catch(() => {});
  }, [highlightId, isAuthenticated]);

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
        className="absolute inset-0 bg-black/50 sm:bg-black/40"
        onClick={onClose}
      />

      {/* Drawer on mobile (slides up), centered modal on desktop */}
      <div
        className="relative w-full max-w-lg bg-surface rounded-t-[20px] sm:rounded-[20px] border border-[rgba(148,163,184,0.25)] shadow-card-soft overflow-hidden flex flex-col h-[85vh] sm:h-auto sm:max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-detail-title"
      >
        {/* Drag handle — mobile drawer affordance */}
        <div className="sm:hidden shrink-0 flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" aria-hidden />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]">
          {/* Header: title + rating + close */}
          <div className="sticky top-0 z-10 flex items-start justify-between gap-2 px-4 py-3 bg-surface border-b border-[rgba(148,163,184,0.25)]">
            <div className="min-w-0 flex-1">
              <h2 id="place-detail-title" className="text-lg font-semibold truncate">
                {data?.name ?? "Place Details"}
              </h2>
              {data && (data.rating != null || data.user_rating_count != null) && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0" />
                  <span className="text-sm font-medium">
                    {data.rating === 9 && data.user_rating_count == null ? "9+" : data.rating}
                  </span>
                  {data.user_rating_count != null && (
                    <span className="text-xs text-muted-foreground">
                      ({data.user_rating_count.toLocaleString()} reviews)
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 -m-2 rounded-full hover:bg-surface-alt transition-colors touch-manipulation shrink-0"
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
                {/* Actions: Maps/Website (left group) | Share/icons (right group). Narrow screens: wrap to 2 rows. */}
                <div className="flex flex-wrap items-center justify-between gap-y-2 sm:flex-nowrap">
                  <div className="flex items-center gap-2">
                    {googleMapsUrl && (
                      <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.preventDefault();
                          openUrl(googleMapsUrl);
                        }}
                        className="inline-flex items-center justify-center gap-1 px-3 h-[32px] rounded-[10px] text-[12px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors touch-manipulation shrink-0"
                      >
                        <MapPin className="w-3 h-3" />
                        Google Maps
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
                        className="inline-flex items-center justify-center gap-1 px-3 h-[32px] rounded-[10px] text-[12px] font-medium border border-[rgba(148,163,184,0.3)] bg-transparent text-muted-foreground hover:text-foreground hover:bg-surface-alt transition-colors touch-manipulation shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Apple Maps
                      </a>
                    )}
                    {data.website && (
                      <a
                        href={data.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.preventDefault();
                          openUrl(data!.website!);
                        }}
                        className="inline-flex items-center justify-center gap-1 px-3 h-[32px] rounded-[10px] text-[12px] font-medium border border-[rgba(148,163,184,0.3)] bg-transparent text-muted-foreground hover:text-foreground hover:bg-surface-alt transition-colors touch-manipulation shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Website
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-1 justify-end min-w-0 sm:ml-4 sm:flex-initial">
                      <button
                        type="button"
                        onClick={async () => {
                          const url = data?.share_url ?? (typeof window !== "undefined" ? window.location.href : "");
                          const placeName = data?.name ?? "this place";
                          const shareData = {
                            title: placeName,
                            text: `Check out ${placeName} on Localist:\n${url}`,
                            url,
                          };
                          try {
                            if (typeof navigator !== "undefined" && navigator.share) {
                              await navigator.share(shareData);
                            } else if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                              await navigator.clipboard.writeText(url);
                              setShareToast(true);
                              setTimeout(() => setShareToast(false), 2000);
                            } else {
                              window.open(url, "_blank");
                            }
                          } catch {
                            // User canceled share; ignore
                          }
                        }}
                        className={cn(ACTION_BTN, "text-muted-foreground hover:text-foreground hover:border-white/30 active:bg-surface-alt/50")}
                        title="Share"
                        aria-label="Share"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
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
                          className={cn(
                            ACTION_BTN,
                            saved
                              ? "border-red-500/40 bg-red-500/10 text-red-500"
                              : "text-muted-foreground hover:text-red-500 hover:border-red-500/30 active:bg-surface-alt/50"
                          )}
                          title={saved ? "Unsave" : "Favorite"}
                          aria-label={saved ? "Unsave" : "Save"}
                        >
                          <Heart className={cn("w-4 h-4", saved && "fill-red-500")} />
                        </button>
                      )}
                      {onVisitedChange && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!isAuthenticated) {
                              window.location.href = "/auth/login?next=/";
                              return;
                            }
                            const next = !localVisited;
                            setLocalVisited(next);
                            onVisitedChange(next);
                          }}
                          className={cn(
                            ACTION_BTN,
                            localVisited
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                              : "text-muted-foreground hover:text-emerald-500 hover:border-emerald-500/30 active:bg-surface-alt/50"
                          )}
                          title={localVisited ? "Unmark visited" : "Visited"}
                          aria-label={localVisited ? "Unmark visited" : "Mark visited"}
                        >
                          <Check className={cn("w-4 h-4", localVisited && "stroke-[2.5]")} />
                        </button>
                      )}
                      {onReject && (
                        <button
                          type="button"
                          onClick={() => {
                            onReject();
                            onClose();
                          }}
                          className={cn(
                            ACTION_BTN,
                            "text-muted-foreground hover:text-foreground hover:border-white/30 active:bg-surface-alt/50"
                          )}
                          title="Not this one"
                          aria-label="Not this one"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                {/* Rating — only when visited */}
                {localVisited && onRatingChange && (
                  <section className="mt-4">
                    <h3 className="text-sm font-medium text-foreground">Rate this place</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Only you see your rating for now.</p>
                    <div className="mt-2 flex gap-1">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={async () => {
                            setLocalRating(v);
                            onRatingChange(v);
                            await fetch("/api/user-place-state", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ placeId: highlightId, rating: v, isVisited: true }),
                            });
                          }}
                          className="p-1 rounded-lg hover:bg-surface-alt transition-colors touch-manipulation"
                          aria-label={`Rate ${v} stars`}
                        >
                          <Star
                            className={`w-8 h-8 ${
                              v <= localRating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Your tags — with spacing above (separate from Actions) */}
                {isAuthenticated && (
                  <section className="pt-2">
                    <h3 className="text-sm font-medium text-foreground">Your tags</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Add your own tags to find this later.</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {localTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={async () => {
                            const res = await fetch("/api/user-tags/remove", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ placeId: highlightId, tag }),
                            });
                            if (res.ok) {
                              const next = localTags.filter((t) => t !== tag);
                              setLocalTags(next);
                              onTagsChange?.(next);
                            }
                          }}
                          className="rounded-[10px] border border-chip-user px-2.5 py-1 text-xs text-[#94A3B8] hover:text-foreground hover:border-slate-400 transition-colors touch-manipulation shrink-0"
                        >
                          {tag}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setTagInputOpen(true)}
                        className="rounded-[10px] border border-dashed border-[rgba(148,163,184,0.4)] px-2.5 py-1 text-xs text-muted-foreground hover:border-white/20 hover:text-foreground transition-colors touch-manipulation shrink-0"
                      >
                        + Add tag
                      </button>
                    </div>
                    {tagInputOpen && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const raw = tagInput.trim().toLowerCase();
                          if (!raw) return;
                          const res = await fetch("/api/user-tags/add", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ placeId: highlightId, tag: raw }),
                          });
                          if (res.ok) {
                            const next = [...localTags, raw];
                            setLocalTags(next);
                            onTagsChange?.(next);
                            setTagInput("");
                            setTagInputOpen(false);
                          }
                        }}
                        className="mt-2 flex gap-2"
                      >
                        <input
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          placeholder="e.g. first date, cozy"
                          className="flex-1 rounded-[10px] border border-border-app bg-surface-alt px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="rounded-[10px] bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTagInputOpen(false);
                            setTagInput("");
                          }}
                          className="rounded-[10px] border border-border-app px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-alt transition-colors"
                        >
                          Cancel
                        </button>
                      </form>
                    )}
                  </section>
                )}

                {data.photo_urls && data.photo_urls.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2">
                    {data.photo_urls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="h-40 w-auto rounded-[14px] object-cover shrink-0"
                      />
                    ))}
                  </div>
                )}

                {data.short_description && (
                  <p className="text-sm text-muted-foreground mb-2">{data.short_description}</p>
                )}

                {data.formatted_address && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(data!.formatted_address!);
                        setCopyToast(true);
                        setTimeout(() => setCopyToast(false), 2000);
                      } catch {
                        if (googleMapsUrl) openUrl(googleMapsUrl);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (googleMapsUrl) openUrl(googleMapsUrl);
                    }}
                    className="flex items-start gap-2 text-sm text-left w-full min-h-[32px] touch-manipulation hover:opacity-90 transition-opacity rounded-[14px] border border-slate-600/50 px-3 py-2"
                  >
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
                    <span className="flex-1 min-w-0 line-clamp-2">{data.formatted_address}</span>
                    <Copy className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-500" />
                  </button>
                )}

                {data.opening_hours && data.opening_hours.length > 0 && (() => {
                  const hoursRows = parseOpeningHours(data.opening_hours);
                  if (hoursRows.length === 0) return null;
                  return (
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Clock className="w-4 h-4 text-slate-400" />
                        Hours
                      </div>
                      <div className="mt-1.5 pl-6 space-y-[3px]">
                        {hoursRows.map((row, i) => (
                          <div
                            key={i}
                            className={cn(
                              "flex gap-2 text-[12px] py-0.5",
                              row.isToday ? "text-slate-100 font-medium" : "text-slate-400"
                            )}
                          >
                            <span className="w-[70px] shrink-0 text-right">{row.dayLabel}</span>
                            <span className="flex-1 text-left">{row.timeRange}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {data.phone && (() => {
                  const e164 = toE164(data.phone);
                  const waLink = `https://wa.me/${e164.replace(/^\+/, "")}`;
                  return (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-slate-500">Phone:</span>
                      <a href={`tel:${e164}`} className="text-foreground hover:underline">
                        {data.phone}
                      </a>
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#25D366]/15 text-[#25D366] text-xs font-medium hover:bg-[#25D366]/25 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        WhatsApp
                      </a>
                    </div>
                  );
                })()}

                {/* Footer: quiet attribution */}
                <p className="pt-6 mt-6 border-t border-[rgba(148,163,184,0.2)] text-[11px] text-slate-500">
                  Details from{" "}
                  <a
                    href="https://foursquare.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-500 hover:text-slate-400 hover:underline focus:underline"
                  >
                    Foursquare
                  </a>
                  {" • "}
                  Maps from{" "}
                  <a
                    href={googleMapsUrl ?? "https://maps.google.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-500 hover:text-slate-400 hover:underline focus:underline"
                  >
                    Google Maps
                  </a>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Copy toasts */}
        {copyToast && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg bg-slate-700 text-slate-100 text-xs font-medium shadow-lg z-20">
            Address copied
          </div>
        )}
        {shareToast && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg bg-slate-700 text-slate-100 text-xs font-medium shadow-lg z-20">
            Link copied – paste into WhatsApp or Messages
          </div>
        )}
      </div>
    </div>
  );
}

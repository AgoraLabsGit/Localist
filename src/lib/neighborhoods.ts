/**
 * Normalize neighborhood names for display and deduplication.
 * Addresses duplicates (Liniers vs LINIERS) and all-CAPS in Area filter.
 */

/** Key for deduplication: lowercase, no diacritics */
export function normalizeNeighborhoodKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

/** Title case for display: "LINIERS" → "Liniers", "LANÚS OESTE" → "Lanús Oeste". Word-based, locale-aware for proper handling of ñ, á, etc. */
export function toTitleCase(name: string): string {
  if (!name?.trim()) return name ?? "";
  return name
    .trim()
    .toLocaleLowerCase("es")
    .split(/\s+/)
    .map((word) => (word.length > 0 ? word[0].toLocaleUpperCase("es") + word.slice(1) : ""))
    .join(" ");
}

/** Dedupe by normalized key and apply title case for display. */
export function dedupeAndNormalize(neighborhoods: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const n of neighborhoods.filter((s) => Boolean(s?.trim()))) {
    const key = normalizeNeighborhoodKey(n);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(toTitleCase(n));
  }
  return result.sort((a, b) => a.localeCompare(b));
}

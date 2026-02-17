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

/** Title case for display: "LINIERS" → "Liniers", "PARQUE PATRICIOS" → "Parque Patricios". Uses char iteration to avoid \b\w treating accented chars as word boundaries. */
export function toTitleCase(name: string): string {
  let result = "";
  let startOfWord = true;
  for (const c of name.toLowerCase()) {
    if (/\s/.test(c)) {
      startOfWord = true;
      result += c;
    } else {
      result += startOfWord ? c.toUpperCase() : c;
      startOfWord = false;
    }
  }
  return result;
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

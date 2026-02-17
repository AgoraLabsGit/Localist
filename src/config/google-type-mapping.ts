/**
 * Google Place type → our category mapping for ingestion.
 *
 * Use with includedType for discovery (ingest-places-typed) when a category
 * maps cleanly to a Google type. For niche categories (parrilla, speakeasy),
 * use a broader type + textQuery keywords.
 *
 * Reference full list: data/google_place_types.json
 */

/** Localist category slug → Google Place types for includedType filter */
export const INGEST_GOOGLE_TYPES: Record<string, string[]> = {
  cafe: ["cafe"],
  bar: ["bar"],
  cocktail_bar: ["bar"],
  wine_bar: ["bar"],
  restaurant: ["restaurant"],
  brunch: ["restaurant"],
  parrilla: ["restaurant"], // broader type; add "parrilla" in textQuery
  heladeria: ["ice_cream_shop"],
  ice_cream: ["ice_cream_shop"],
  museum: ["museum"],
  park: ["park"],
  night_club: ["night_club"],
  theater: ["movie_theater"], // or live theater; adjust if needed
  bookstore: ["book_store"],
  zoo: ["zoo"],
  aquarium: ["aquarium"],
  stadium: ["stadium"],
  art_gallery: ["art_gallery"],
  gym: ["gym"],
  lodging: ["lodging"],
  shopping_mall: ["shopping_mall"],
  tourist_attraction: ["tourist_attraction"],
};

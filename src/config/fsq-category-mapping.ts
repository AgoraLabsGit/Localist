/**
 * Foursquare category name → our category slug mapping for ingestion.
 *
 * Use fsq_categories (on venues) + this mapping to refine category and
 * category_group, and provide richer context to the AI layer later.
 *
 * Reference full list: data/foursquare_categories.json
 */

/** Localist category slug → Foursquare category names for ingestion mapping */
export const INGEST_FSQ_CATEGORIES: Record<string, string[]> = {
  ice_cream: ["Ice Cream Shop"],
  heladeria: ["Ice Cream Shop", "Heladería"],
  parrilla: ["Steakhouse", "BBQ Joint", "Argentinian Restaurant"],
  cajun: ["Cajun Restaurant", "Creole Restaurant"],
  po_boy: ["Sandwich Shop", "American Restaurant"],
  cafe: ["Café", "Coffee Shop", "Cafeteria"],
  restaurant: ["Restaurant", "American Restaurant"],
  brunch: ["Breakfast Spot", "Brunch Spot"],
  bar: ["Bar", "Pub"],
  cocktail_bar: ["Cocktail Bar", "Speakeasy"],
  wine_bar: ["Wine Bar"],
  jazz_bar: ["Jazz Club", "Music Venue"],
  tango_bar: ["Dance Studio", "Music Venue"],
  nightlife: ["Nightclub", "Speakeasy"],
  night_club: ["Nightclub"],
  rooftop: ["Rooftop Bar", " rooftop"],
  museum: ["Museum", "Art Museum", "History Museum"],
  park: ["Park", "Plaza", "Garden"],
  bookstore: ["Bookstore"],
  theater: ["Performing Arts Theater", "Movie Theater"],
  kids_activities: ["Playground", "Amusement Park", "Zoo", "Aquarium"],
  tours: ["Tour Provider", "Tour Operator"],
  waterfront: ["Beach", "Marina", "Waterfront"],
};

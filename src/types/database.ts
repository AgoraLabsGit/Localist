// Manual types (run `npm run db:types` with local Supabase for generated types)

export interface Venue {
  id: string;
  google_place_id: string | null;
  foursquare_id: string | null;
  name: string;
  address: string | null;
  city: string;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website_url: string | null;
  rating: number | null;
  rating_count: number | null;
  opening_hours: unknown;
  photo_urls?: string[];
  created_at: string;
  updated_at: string;
}

export interface Highlight {
  id: string;
  title: string;
  short_description: string | null;
  category: string;
  vibe_tags: string[] | unknown;
  venue_id: string | null;
  city: string;
  neighborhood: string | null;
  avg_expected_price: number | null;
  currency: string | null;
  url: string | null;
  is_featured: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  venue?: Venue | Venue[] | null;
}

// Placeholder — run `npm run db:types` after Supabase setup to generate real types

export interface Venue {
  id: string;
  google_place_id: string | null;
  name: string;
  address: string | null;
  city: string;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website_url: string | null;
  google_rating: number | null;
  google_rating_count: number | null;
  opening_hours: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Highlight {
  id: string;
  title: string;
  short_description: string | null;
  category: string;
  vibe_tags: string[];
  venue_id: string | null;
  city: string;
  neighborhood: string | null;
  avg_expected_price: number | null;
  currency: string;
  url: string | null;
  is_featured: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  // Joined
  venue?: Venue;
}

export interface SavedItem {
  id: string;
  user_id: string;
  target_type: "highlight" | "event";
  target_id: string;
  created_at: string;
}

export interface Rating {
  id: string;
  user_id: string;
  target_type: string;
  target_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

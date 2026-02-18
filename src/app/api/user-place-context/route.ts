import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/user-place-context?placeId=xxx
 * Returns user's state (saved, visited, rating) and tags for a place.
 * Requires auth. Returns empty state if not found.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const placeId = req.nextUrl.searchParams.get("placeId");
  if (!placeId) {
    return NextResponse.json({ error: "Missing placeId" }, { status: 400 });
  }

  const [stateRes, tagsRes] = await Promise.all([
    supabase
      .from("user_place_state")
      .select("is_saved, is_visited, rating")
      .eq("user_id", user.id)
      .eq("place_id", placeId)
      .maybeSingle(),
    supabase
      .from("user_place_tags")
      .select("tag")
      .eq("user_id", user.id)
      .eq("place_id", placeId),
  ]);

  const state = stateRes.data;
  const tags = (tagsRes.data ?? []).map((r) => r.tag as string);

  return NextResponse.json({
    userState: state
      ? {
          isSaved: state.is_saved,
          isVisited: state.is_visited,
          rating: state.rating ?? undefined,
        }
      : { isSaved: false, isVisited: false },
    userTags: tags,
  });
}

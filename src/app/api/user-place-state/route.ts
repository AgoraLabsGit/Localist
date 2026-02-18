import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { placeId, isSaved, isVisited, rating } = body;

  if (!placeId) {
    return NextResponse.json({ error: "Missing placeId" }, { status: 400 });
  }

  if (rating !== undefined && (rating < 1 || rating > 5)) {
    return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("user_place_state")
    .select("*")
    .eq("user_id", user.id)
    .eq("place_id", placeId)
    .maybeSingle();

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (isSaved !== undefined) payload.is_saved = isSaved;
  if (isVisited !== undefined) payload.is_visited = isVisited;
  if (rating !== undefined) payload.rating = rating;

  let result;
  if (!existing) {
    result = await supabase
      .from("user_place_state")
      .insert({
        user_id: user.id,
        place_id: placeId,
        is_saved: isSaved ?? false,
        is_visited: isVisited ?? false,
        rating: rating ?? null,
        ...payload,
      })
      .select()
      .single();
  } else {
    result = await supabase
      .from("user_place_state")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json(result.data);
}

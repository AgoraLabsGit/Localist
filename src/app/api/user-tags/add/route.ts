import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { placeId, tag: rawTag } = body;

  if (!placeId || !rawTag) {
    return NextResponse.json({ error: "Missing placeId or tag" }, { status: 400 });
  }

  const tag = String(rawTag).trim().toLowerCase();
  if (!tag) {
    return NextResponse.json({ error: "Tag cannot be empty" }, { status: 400 });
  }

  const { error } = await supabase.from("user_place_tags").insert({
    user_id: user.id,
    place_id: placeId,
    tag,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, tag });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, tag });
}

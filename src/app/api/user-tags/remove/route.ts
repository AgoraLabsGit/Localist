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

  await supabase
    .from("user_place_tags")
    .delete()
    .eq("user_id", user.id)
    .eq("place_id", placeId)
    .eq("tag", tag);

  return NextResponse.json({ ok: true });
}

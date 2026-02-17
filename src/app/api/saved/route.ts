import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { highlightId } = await request.json();
  if (!highlightId) {
    return NextResponse.json({ error: "Missing highlightId" }, { status: 400 });
  }
  const { error } = await supabase.from("saved_items").insert({
    user_id: user.id,
    target_type: "highlight",
    target_id: highlightId,
  });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ saved: true });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ saved: true });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const highlightId = searchParams.get("highlightId");
  if (!highlightId) {
    return NextResponse.json({ error: "Missing highlightId" }, { status: 400 });
  }
  await supabase
    .from("saved_items")
    .delete()
    .eq("user_id", user.id)
    .eq("target_type", "highlight")
    .eq("target_id", highlightId);
  return NextResponse.json({ saved: false });
}

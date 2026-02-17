import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ cityId: string }> }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { cityId } = await params;
  const body = await req.json();
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("city_neighborhoods")
    .insert({ city_id: cityId, name })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Neighborhood already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}

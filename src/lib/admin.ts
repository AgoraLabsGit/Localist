/**
 * Admin check: user must have role='admin' in public.users.
 * Set via SQL: UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function isAdmin(
  supabase: SupabaseClient,
  userId: string | undefined | null
): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();
  return data?.role === "admin";
}

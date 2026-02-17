"use client";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  async function handleSignOut() {
    await createClient().auth.signOut();
    window.location.href = "/";
  }
  return (
    <button
      onClick={handleSignOut}
      className="px-4 py-2 rounded-lg border border-destructive text-destructive hover:bg-destructive/10"
    >
      Sign out
    </button>
  );
}

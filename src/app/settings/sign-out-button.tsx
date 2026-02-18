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
      className="px-4 py-2 rounded-[14px] border border-destructive text-destructive hover:bg-destructive/10 transition-colors touch-manipulation font-body"
    >
      Sign out
    </button>
  );
}

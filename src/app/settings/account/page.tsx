import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AccountPageClient } from "./account-page-client";

export default async function AccountPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login?next=/settings/account");
  }

  return (
    <div className="min-h-screen bg-app font-body">
      <header className="sticky top-0 z-50 bg-app border-b border-[rgba(148,163,184,0.25)]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
            ← Back
          </Link>
          <h1 className="text-xl font-body font-semibold text-foreground">Account</h1>
          <div className="w-12" />
        </div>
      </header>
      <div className="max-w-lg mx-auto px-4 py-6">
        <AccountPageClient userEmail={user.email ?? ""} />
      </div>
    </div>
  );
}

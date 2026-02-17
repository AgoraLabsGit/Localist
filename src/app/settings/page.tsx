import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "./sign-out-button";
import { LocationSection } from "./location-section";
import { PreferencesSection } from "./preferences-section";
import { isAdmin } from "@/lib/admin";

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login?next=/settings");
  }
  const isAdminUser = await isAdmin(supabase, user.id);
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            ← Back
          </Link>
          <h1 className="text-xl font-bold text-primary">Settings</h1>
          <div className="w-12" />
        </div>
      </header>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Email</p>
          <p className="font-medium">{user.email}</p>
        </div>
        <div className="rounded-lg border p-4">
          <LocationSection />
        </div>
        <div className="rounded-lg border p-4">
          <PreferencesSection />
        </div>
        {isAdminUser && (
          <Link
            href="/admin"
            className="block rounded-lg border p-3 hover:bg-accent/50"
          >
            <span className="font-medium">Admin</span>
            <p className="text-sm text-muted-foreground">Manage cities, categories</p>
          </Link>
        )}
        <SignOutButton />
      </div>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "./sign-out-button";
import { LocationSection } from "./location-section";
import { FavoriteNeighborhoodsSection } from "./favorite-neighborhoods-section";
import { SettingsPreferencesBlock } from "./settings-preferences-block";
import { PersonaSection, WeekdayPreferencesSection, WeekendPreferencesSection, VibeTagsSection, BudgetSection, WhenAndHowOftenSection, TouristVsLocalSection, ConstraintsSection } from "./concierge-preferences-sections";
import { isAdmin } from "@/lib/admin";

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login?next=/settings");
  }
  const isAdminUser = await isAdmin(supabase, user.id);
  return (
    <div className="min-h-screen bg-app font-body">
      <header className="sticky top-0 z-50 bg-app border-b border-[rgba(148,163,184,0.25)]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
            ← Back
          </Link>
          <h1 className="text-xl font-body font-semibold text-foreground">Settings</h1>
          <div className="w-12" />
        </div>
      </header>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <Link
          href="/settings/account"
          className="block rounded-[20px] border border-[rgba(148,163,184,0.25)] bg-surface p-4 hover:bg-surface-alt transition-colors"
        >
          <span className="font-medium text-foreground">Account</span>
          <p className="text-sm text-muted-foreground mt-0.5">Membership, email, password</p>
        </Link>
        <div className="rounded-[20px] border border-[rgba(148,163,184,0.25)] bg-surface p-4">
          <LocationSection />
        </div>
        <div className="rounded-[20px] border border-[rgba(148,163,184,0.25)] bg-surface p-4">
          <FavoriteNeighborhoodsSection />
        </div>
        <SettingsPreferencesBlock />
        <div className="rounded-[20px] border border-[rgba(148,163,184,0.25)] bg-surface p-4">
          <PersonaSection />
        </div>
        <div className="rounded-[20px] border border-[rgba(148,163,184,0.25)] bg-surface p-4">
          <WhenAndHowOftenSection />
        </div>
        <div className="rounded-[20px] border border-[rgba(148,163,184,0.25)] bg-surface p-4">
          <WeekdayPreferencesSection />
        </div>
        <div className="rounded-[20px] border border-[rgba(148,163,184,0.25)] bg-surface p-4">
          <WeekendPreferencesSection />
        </div>
        <div className="rounded-[20px] border border-[rgba(148,163,184,0.25)] bg-surface p-4">
          <VibeTagsSection />
        </div>
        <div className="rounded-[20px] border border-[rgba(148,163,184,0.25)] bg-surface p-4">
          <BudgetSection />
        </div>
        <div className="rounded-[20px] border border-[rgba(148,163,184,0.25)] bg-surface p-4">
          <TouristVsLocalSection />
        </div>
        <div className="rounded-[20px] border border-[rgba(148,163,184,0.25)] bg-surface p-4">
          <ConstraintsSection />
        </div>
        {isAdminUser && (
          <Link
            href="/admin"
            className="block rounded-[20px] border border-[rgba(148,163,184,0.25)] bg-surface p-3 hover:bg-surface-alt transition-colors"
          >
            <span className="font-medium text-foreground">Admin</span>
            <p className="text-sm text-muted-foreground">Manage cities, categories</p>
          </Link>
        )}
        <SignOutButton />
      </div>
    </div>
  );
}

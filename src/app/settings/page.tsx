import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "./sign-out-button";
import { LocationSection } from "./location-section";
import { FavoriteNeighborhoodsSection } from "./favorite-neighborhoods-section";
import { SettingsPreferencesBlock } from "./settings-preferences-block";
import { PersonaSection, WeekdayPreferencesSection, WeekendPreferencesSection, VibeTagsSection, BudgetSection, WhenAndHowOftenSection, TouristVsLocalSection, ConstraintsSection } from "./concierge-preferences-sections";
import { ThemeSection } from "./theme-section";
import { LanguageSection } from "./language-section";
import { isAdmin } from "@/lib/admin";

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login?next=/settings");
  }
  const isAdminUser = await isAdmin(supabase, user.id);
  const t = await getTranslations("common");
  const tSettings = await getTranslations("settings");

  return (
    <div className="min-h-screen bg-app font-body">
      <header className="sticky top-0 z-50 bg-app border-b border-border-app">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
            {t("back")}
          </Link>
          <h1 className="text-xl font-body font-semibold text-foreground">{t("settings")}</h1>
          <div className="w-12" />
        </div>
      </header>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <ThemeSection />
        <LanguageSection />
        <Link
          href="/settings/account"
          className="block rounded-[20px] border border-border-app bg-surface p-4 hover:bg-surface-alt transition-colors"
        >
          <span className="font-medium text-foreground">{t("account")}</span>
          <p className="text-sm text-muted-foreground mt-0.5">{tSettings("accountDesc")}</p>
        </Link>
        <div className="rounded-[20px] border border-border-app bg-surface p-4">
          <LocationSection />
        </div>
        <div className="rounded-[20px] border border-border-app bg-surface p-4">
          <FavoriteNeighborhoodsSection />
        </div>
        <SettingsPreferencesBlock />
        <div className="rounded-[20px] border border-border-app bg-surface p-4">
          <PersonaSection />
        </div>
        <div className="rounded-[20px] border border-border-app bg-surface p-4">
          <WhenAndHowOftenSection />
        </div>
        <div className="rounded-[20px] border border-border-app bg-surface p-4">
          <WeekdayPreferencesSection />
        </div>
        <div className="rounded-[20px] border border-border-app bg-surface p-4">
          <WeekendPreferencesSection />
        </div>
        <div className="rounded-[20px] border border-border-app bg-surface p-4">
          <VibeTagsSection />
        </div>
        <div className="rounded-[20px] border border-border-app bg-surface p-4">
          <BudgetSection />
        </div>
        <div className="rounded-[20px] border border-border-app bg-surface p-4">
          <TouristVsLocalSection />
        </div>
        <div className="rounded-[20px] border border-border-app bg-surface p-4">
          <ConstraintsSection />
        </div>
        {isAdminUser && (
          <Link
            href="/admin"
            className="block rounded-[20px] border border-border-app bg-surface p-3 hover:bg-surface-alt transition-colors"
          >
            <span className="font-medium text-foreground">{tSettings("admin")}</span>
            <p className="text-sm text-muted-foreground">{tSettings("adminDesc")}</p>
          </Link>
        )}
        <SignOutButton />
      </div>
    </div>
  );
}

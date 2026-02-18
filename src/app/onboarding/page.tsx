import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { SkipOnboardingButton } from "@/components/skip-onboarding-button";

export default async function OnboardingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login?next=/onboarding");
  }

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("onboarding_completed_at")
    .eq("user_id", user.id)
    .single();

  if (prefs?.onboarding_completed_at) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-app">
      <header className="sticky top-0 z-50 bg-app border-b border-[rgba(148,163,184,0.25)]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-logo text-foreground">Localist</h1>
          <SkipOnboardingButton />
        </div>
      </header>
      <div className="max-w-lg mx-auto px-4 py-8">
        <OnboardingFlow />
      </div>
    </main>
  );
}
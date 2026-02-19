import { getTranslations } from "next-intl/server";
import { ThemeToggle } from "@/components/theme-toggle";

export async function ThemeSection() {
  const t = await getTranslations("common");

  return (
    <div className="rounded-[20px] border border-border-app bg-surface p-4">
      <h3 className="font-medium text-foreground mb-3">{t("appearance")}</h3>
      <ThemeToggle />
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { LanguagePicker } from "@/components/language-picker";

export async function LanguageSection() {
  const t = await getTranslations("common");

  return (
    <div className="rounded-[20px] border border-border-app bg-surface p-4">
      <h3 className="font-medium text-foreground mb-3">{t("language")}</h3>
      <LanguagePicker />
    </div>
  );
}

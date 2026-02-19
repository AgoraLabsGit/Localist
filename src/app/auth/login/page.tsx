"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-app">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">{t("welcomeBack")}</h1>
          <p className="text-muted-foreground mt-1">{t("signInToLocalist")}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
              {t("email")}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-[14px] border border-border-app bg-surface-alt text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder={t("emailPlaceholder")}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
              {t("password")}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-[14px] border border-border-app bg-surface-alt text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <p className="text-right">
            <Link href="/auth/forgot-password" className="text-sm text-muted-foreground hover:text-primary">
              {t("forgotPassword")}
            </Link>
          </p>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-[14px] bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors touch-manipulation"
          >
            {loading ? t("signingIn") : t("signIn")}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <Link href="/auth/signup" className="text-primary hover:underline">
            {t("signUp")}
          </Link>
        </p>
      </div>
    </div>
  );
}

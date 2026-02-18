"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function AccountPageClient({ userEmail }: { userEmail: string }) {
  const [emailStep, setEmailStep] = useState<"view" | "edit" | "confirm">("view");
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    if (newEmail !== confirmEmail) {
      setEmailError("Emails do not match");
      return;
    }
    if (newEmail === userEmail) {
      setEmailError("New email is the same as current");
      return;
    }
    setEmailLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailLoading(false);
    if (error) {
      setEmailError(error.message);
      return;
    }
    setEmailSuccess(true);
    setEmailStep("view");
    setNewEmail("");
    setConfirmEmail("");
  };

  return (
    <div className="space-y-6">
      {/* Membership - placeholder */}
      <div className="rounded-[20px] border border-[rgba(148,163,184,0.25)] bg-surface p-4">
        <h2 className="font-semibold text-foreground">Membership</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage your subscription and billing.</p>
        <button
          type="button"
          disabled
          className="mt-3 w-full rounded-[14px] border border-[rgba(148,163,184,0.4)] px-4 py-2.5 text-sm font-medium text-muted-foreground cursor-not-allowed"
        >
          Manage membership (coming soon)
        </button>
      </div>

      {/* Login - placeholder */}
      <div className="rounded-[20px] border border-[rgba(148,163,184,0.25)] bg-surface p-4">
        <h2 className="font-semibold text-foreground">Login</h2>
        <p className="text-sm text-muted-foreground mt-1">Connected accounts and sign-in options.</p>
        <button
          type="button"
          disabled
          className="mt-3 w-full rounded-[14px] border border-[rgba(148,163,184,0.4)] px-4 py-2.5 text-sm font-medium text-muted-foreground cursor-not-allowed"
        >
          Manage login (coming soon)
        </button>
      </div>

      {/* Password */}
      <div className="rounded-[20px] border border-[rgba(148,163,184,0.25)] bg-surface p-4">
        <h2 className="font-semibold text-foreground">Password</h2>
        <p className="text-sm text-muted-foreground mt-1">Reset your password via email.</p>
        <Link
          href="/auth/forgot-password"
          className="mt-3 inline-block w-full rounded-[14px] border border-[rgba(148,163,184,0.4)] bg-slate-900 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-slate-800 transition-colors text-center"
        >
          Reset password
        </Link>
      </div>

      {/* Email */}
      <div className="rounded-[20px] border border-[rgba(148,163,184,0.25)] bg-surface p-4">
        <h2 className="font-semibold text-foreground">Email</h2>
        <p className="text-sm text-muted-foreground mt-1">Your email address. A confirmation link will be sent to the new address.</p>

        {emailStep === "view" && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-foreground">{userEmail}</p>
            <button
              type="button"
              onClick={() => setEmailStep("edit")}
              className="text-accent-cyan hover:underline text-sm font-medium"
            >
              Change
            </button>
          </div>
        )}

        {emailStep === "edit" && (
          <form onSubmit={handleEmailChange} className="mt-3 space-y-3">
            <div>
              <label htmlFor="new-email" className="block text-xs font-medium text-muted-foreground mb-1">New email</label>
              <input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-[14px] border border-[rgba(148,163,184,0.4)] bg-slate-900 px-4 py-3 text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-cyan/30"
              />
            </div>
            <div>
              <label htmlFor="confirm-email" className="block text-xs font-medium text-muted-foreground mb-1">Confirm new email</label>
              <input
                id="confirm-email"
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-[14px] border border-[rgba(148,163,184,0.4)] bg-slate-900 px-4 py-3 text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-cyan/30"
              />
            </div>
            {emailError && <p className="text-sm text-destructive">{emailError}</p>}
            {emailSuccess && <p className="text-sm text-green-500">Check your new email for a confirmation link.</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setEmailStep("view"); setEmailError(null); setNewEmail(""); setConfirmEmail(""); }}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={emailLoading}
                className="flex-1 rounded-[14px] bg-accent-cyan py-2 text-sm font-medium text-white hover:bg-accent-cyan/90 disabled:opacity-50"
              >
                {emailLoading ? "Sending…" : "Update email"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

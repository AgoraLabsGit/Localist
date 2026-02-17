"use client";

import { useState } from "react";

interface AdminSettingsClientProps {
  initialSettings: Record<string, string>;
  descriptions: Record<string, string>;
}

export function AdminSettingsClient({
  initialSettings,
  descriptions,
}: AdminSettingsClientProps) {
  const [maxFsq, setMaxFsq] = useState(
    initialSettings.max_foursquare_calls_per_run ?? ""
  );
  const [maxGoogle, setMaxGoogle] = useState(
    initialSettings.max_google_calls_per_run ?? ""
  );
  const [aiEnabled, setAiEnabled] = useState(
    initialSettings.ai_enrichment_enabled === "true"
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_foursquare_calls_per_run: maxFsq.trim() || "",
          max_google_calls_per_run: maxGoogle.trim() || "",
          ai_enrichment_enabled: aiEnabled,
        }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1">Max Foursquare calls per run</label>
        <input
          type="text"
          value={maxFsq}
          onChange={(e) => setMaxFsq(e.target.value)}
          placeholder="Empty = no limit"
          className="rounded border px-3 py-1.5 text-sm w-32"
        />
        <p className="text-xs text-muted-foreground mt-0.5">
          {descriptions.max_foursquare_calls_per_run}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Max Google calls per run</label>
        <input
          type="text"
          value={maxGoogle}
          onChange={(e) => setMaxGoogle(e.target.value)}
          placeholder="Empty = no limit"
          className="rounded border px-3 py-1.5 text-sm w-32"
        />
        <p className="text-xs text-muted-foreground mt-0.5">
          {descriptions.max_google_calls_per_run}
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={aiEnabled}
            onChange={(e) => setAiEnabled(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm font-medium">AI enrichment enabled</span>
        </label>
        <p className="text-xs text-muted-foreground mt-0.5 ml-6">
          {descriptions.ai_enrichment_enabled}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && (
          <span className="text-sm text-green-600 dark:text-green-400">Saved</span>
        )}
      </div>
    </div>
  );
}

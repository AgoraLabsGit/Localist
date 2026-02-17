"use client";

import { useState } from "react";
import Link from "next/link";

export default function AdminOnboardPage() {
  const [cityName, setCityName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ config?: object; slug?: string; error?: string } | null>(null);

  const generate = async (save: boolean) => {
    if (!cityName.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/onboard-city", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityName: cityName.trim(), save }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data.error ?? "Request failed" });
        return;
      }
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-muted-foreground hover:text-foreground">
          ← Cities
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">Add City with AI</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate a city config using AI. Review before saving.
        </p>
      </div>
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">City name</label>
          <input
            type="text"
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            placeholder="e.g. Lisbon, Tokyo"
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => generate(false)}
            disabled={loading || !cityName.trim()}
            className="rounded bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80 disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate"}
          </button>
          <button
            type="button"
            onClick={() => generate(true)}
            disabled={loading || !cityName.trim()}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "…" : "Generate & Save"}
          </button>
        </div>
      </div>
      {result?.error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {result.error}
        </div>
      )}
      {result?.config && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold mb-2">Generated config</h2>
          <pre className="text-xs overflow-auto max-h-96 rounded bg-muted p-3">
            {JSON.stringify(result.config, null, 2)}
          </pre>
          {result.slug && (
            <p className="mt-2 text-sm text-muted-foreground">
              Saved. Run: <code>npx tsx scripts/ingest-places.ts {result.slug}</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

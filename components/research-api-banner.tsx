"use client";

/* ─── Research API banner ──────────────────────────────────────────────
 *  Surfaces a broken research-data path at the top of the app instead of
 *  letting every page render zeros. Silent on a healthy connection.
 * ────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import type { ResearchApiHealth } from "@/lib/data/health";

export function ResearchApiBanner() {
  const [health, setHealth] = useState<ResearchApiHealth | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/research-health")
      .then((r) => (r.ok ? r.json() : null))
      .then((h: ResearchApiHealth | null) => {
        if (!cancelled && h && !h.ok) setHealth(h);
      })
      .catch(() => {
        // A failed probe is not itself worth a banner — the pages will
        // show their own empty states.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!health) return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-destructive/30 bg-destructive/10 px-4 py-2"
    >
      <span className="font-mono text-[10px] uppercase tracking-wider text-destructive">
        {health.code ?? "Config"}
      </span>
      <span className="text-xs font-medium text-foreground">{health.title}</span>
      {health.fix && (
        <span className="text-xs text-muted-foreground">{health.fix}</span>
      )}
    </div>
  );
}

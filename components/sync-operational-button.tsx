"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SyncResponse {
  scanned: number;
  inserted: number;
  cases_with_writes: number;
}

export function SyncOperationalButton({
  limit = 200,
  variant = "outline",
  size = "sm",
}: {
  limit?: number;
  variant?: "default" | "outline";
  size?: "sm" | "default";
}) {
  const [isPending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<SyncResponse | null>(null);

  function handleClick() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/sync/operational-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit }),
        });
        const body = await res.json();
        if (!res.ok) {
          toast.error(body.error ?? `Sync failed (${res.status})`);
          return;
        }
        setLastResult(body);
        if (body.inserted === 0) {
          toast.success(
            `Scanned ${body.scanned} case${body.scanned === 1 ? "" : "s"} · already in sync`,
          );
        } else {
          toast.success(
            `Synced ${body.inserted} event${body.inserted === 1 ? "" : "s"} across ${body.cases_with_writes} case${body.cases_with_writes === 1 ? "" : "s"}`,
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Sync failed");
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? "Syncing…" : "Sync from SOSCOMMAND"}
      </Button>
      {lastResult && !isPending && (
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground tabular-nums">
          last · {lastResult.inserted} new · {lastResult.scanned} scanned
        </span>
      )}
    </div>
  );
}

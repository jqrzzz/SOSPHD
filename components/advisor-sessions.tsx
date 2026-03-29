"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatDate } from "@/lib/utils";
import { createSessionAction } from "@/lib/advisor-actions";
import type { AdvisorSession } from "@/lib/data/advisor-types";

interface SessionsListProps {
  sessions: AdvisorSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
}

export function AdvisorSessionsList({
  sessions,
  activeSessionId,
  onSelectSession,
}: SessionsListProps) {
  const [isPending, startTransition] = useTransition();

  function handleNewSession() {
    startTransition(async () => {
      const result = await createSessionAction();
      onSelectSession(result.id);
    });
  }

  return (
    <div className="flex h-full w-48 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sessions
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={handleNewSession}
          disabled={isPending}
        >
          + New
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-1.5">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={cn(
                "flex flex-col gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors",
                session.id === activeSessionId
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <span className="text-xs font-medium leading-tight">
                {session.title}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {formatDate(session.created_at, "short")}
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

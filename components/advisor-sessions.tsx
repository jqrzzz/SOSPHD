"use client";

import { useTransition } from "react";
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
    <div className="hidden h-full w-60 flex-col border-r border-border/60 bg-sidebar sm:flex">
      <div className="flex items-center justify-between border-b border-sidebar-border/80 px-4 py-3">
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-semibold text-sidebar-foreground/90">
            Sessions
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-sidebar-foreground/40">
            {sessions.length} thread{sessions.length === 1 ? "" : "s"}
          </span>
        </div>
        <button
          onClick={handleNewSession}
          disabled={isPending}
          className="group flex h-7 items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-primary transition-all hover:border-primary/40 hover:bg-primary/15 disabled:opacity-50"
        >
          <span className="text-sm leading-none">+</span>
          New
        </button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-background/40">
                <span className="font-mono text-base text-muted-foreground/50">
                  +
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground/70">
                No sessions yet. Start one to chat with the advisor.
              </p>
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <button
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={cn(
                    "group relative flex flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-all duration-150",
                    isActive
                      ? "bg-gradient-to-r from-sidebar-accent to-sidebar-accent/40 text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-primary transition-opacity",
                      isActive
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-30",
                    )}
                  />
                  <span className="line-clamp-1 text-[12px] font-medium leading-tight">
                    {session.title}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-sidebar-foreground/40">
                    {formatDate(session.created_at, "short")}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

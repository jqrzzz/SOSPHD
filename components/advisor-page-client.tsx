"use client";

import { useState } from "react";
import { AdvisorSessionsList } from "@/components/advisor-sessions";
import { AdvisorChat } from "@/components/advisor-chat";
import { AdvisorContextPanel } from "@/components/advisor-context-panel";
import { PhiWarning } from "@/components/phi-warning";
import type { AdvisorSession, ContextSnapshot } from "@/lib/data/advisor-types";
import type { AgentInsights } from "@/components/advisor-context-panel";

interface AdvisorPageClientProps {
  sessions: AdvisorSession[];
  context: ContextSnapshot;
  agentInsights?: AgentInsights;
}

export function AdvisorPageClient({
  sessions,
  context,
  agentInsights,
}: AdvisorPageClientProps) {
  const [activeSessionId, setActiveSessionId] = useState<string>(
    sessions[0]?.id ?? "",
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PhiWarning />

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        <AdvisorSessionsList
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          {activeSessionId ? (
            <AdvisorChat sessionId={activeSessionId} />
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-card/60 font-mono text-base text-muted-foreground">
                  +
                </div>
                <p className="text-sm text-muted-foreground">
                  Start a new session to chat with the advisor.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="hidden w-72 border-l border-border/60 bg-background/40 lg:block">
          <AdvisorContextPanel
            context={context}
            agentInsights={agentInsights}
          />
        </div>
      </div>
    </div>
  );
}

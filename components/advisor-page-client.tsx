"use client";

import { useState } from "react";
import { AdvisorSessionsList } from "@/components/advisor-sessions";
import { AdvisorChat } from "@/components/advisor-chat";
import { AdvisorContextPanel } from "@/components/advisor-context-panel";
import { PhiWarning } from "@/components/phi-warning";
import {
  QuickCaptureNote,
  QuickCaptureTask,
} from "@/components/advisor-quick-capture";
import type { AdvisorSession, ContextSnapshot } from "@/lib/data/advisor-types";

interface AdvisorPageClientProps {
  sessions: AdvisorSession[];
  context: ContextSnapshot;
}

export function AdvisorPageClient({
  sessions,
  context,
}: AdvisorPageClientProps) {
  const [activeSessionId, setActiveSessionId] = useState<string>(
    sessions[0]?.id ?? "",
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PhiWarning />

      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <h1 className="text-sm font-semibold text-foreground">
          Research Advisor
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <QuickCaptureNote />
          <QuickCaptureTask />
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Sessions */}
        <AdvisorSessionsList
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
        />

        {/* Center: Chat */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {activeSessionId ? (
            <AdvisorChat sessionId={activeSessionId} />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Create a session to start chatting with the advisor.
              </p>
            </div>
          )}
        </div>

        {/* Right: Context panel */}
        <div className="hidden w-64 border-l border-border lg:block">
          <AdvisorContextPanel context={context} />
        </div>
      </div>
    </div>
  );
}

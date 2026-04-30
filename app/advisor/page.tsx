import { getSessions } from "@/lib/data/advisor-store";
import { buildContextSnapshot } from "@/lib/data/context-builder";
import { AdvisorPageClient } from "@/components/advisor-page-client";
import { getResearchPulse, suggestNextActions } from "@/lib/agent";

export default async function AdvisorPage() 

  const agentInsights = {
    score: pulse.score,
    health: pulse.health,
    corridorCoverage: pulse.corridorCoverage,
    highPriorityGaps: pulse.highPriorityGaps,
    totalGaps: pulse.totalGaps,
    openTasks: pulse.openTasks,
    actions,
  };

  return (
    <AdvisorPageClient
      sessions={sessions}
      context={context}
      agentInsights={agentInsights}
    />
  );
}

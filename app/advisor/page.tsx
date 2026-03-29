import { getSessions } from "@/lib/data/advisor-store";
import { buildContextSnapshot } from "@/lib/data/context-builder";
import { AdvisorPageClient } from "@/components/advisor-page-client";

export default function AdvisorPage() {
  const sessions = getSessions();
  const context = buildContextSnapshot();

  return <AdvisorPageClient sessions={sessions} context={context} />;
}

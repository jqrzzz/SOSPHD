import { getSessions } from "@/lib/data/advisor-store";
import { buildContextSnapshot } from "@/lib/data/context-builder";
import { AdvisorPageClient } from "@/components/advisor-page-client";

export default async function AdvisorPage() {
  const sessions = await getSessions();
  const context = await buildContextSnapshot();

  return <AdvisorPageClient sessions={sessions} context={context} />;
}

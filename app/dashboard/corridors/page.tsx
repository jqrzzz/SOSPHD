import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getCorridorBriefing } from "@/lib/agent";
import { RESEARCH_DOMAIN } from "@/lib/agent/domain";

export default async function CorridorsPage() {
  const briefings = await Promise.all(
    RESEARCH_DOMAIN.corridors.map((c) => getCorridorBriefing(c.name)),
  );

  const corridors = briefings.filter(Boolean) as NonNullable<
    Awaited<ReturnType<typeof getCorridorBriefing>>
  >[];

  const coveredCount = corridors.filter((c) => c.coverage.hasData).length;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">
          Corridor Briefings
        </h1>
        <p className="text-sm text-muted-foreground">
          Coverage and intelligence for all {corridors.length} research corridors.
          {coveredCount}/{corridors.length} have field data.
        </p>
      </header>

      <div className="flex flex-col gap-4 p-3 sm:p-6">
        {/* Coverage overview */}
        <div className="flex items-center gap-4">
          <Progress
            value={(coveredCount / corridors.length) * 100}
            className="h-2 flex-1"
          />
          <span className="text-sm font-mono text-muted-foreground">
            {coveredCount}/{corridors.length}
          </span>
        </div>

        {/* Corridor cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {corridors.map((corridor) => (
            <Card
              key={corridor.id}
              className={
                corridor.coverage.hasData
                  ? "border-primary/20"
                  : "border-border opacity-80"
              }
            >
              <CardContent className="flex flex-col gap-3 p-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">
                    {corridor.name}
                  </h2>
                  <Badge
                    variant="outline"
                    className={
                      corridor.coverage.hasData
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]"
                        : "border-red-500/30 bg-red-500/10 text-red-400 text-[10px]"
                    }
                  >
                    {corridor.coverage.hasData ? "Has Data" : "No Data"}
                  </Badge>
                </div>

                {/* Characteristics */}
                <div className="flex flex-wrap gap-1">
                  {corridor.characteristics.map((c) => (
                    <Badge
                      key={c}
                      variant="secondary"
                      className="text-[10px]"
                    >
                      {c}
                    </Badge>
                  ))}
                </div>

                {/* Known bottlenecks */}
                {corridor.knownBottlenecks.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Known Bottlenecks
                    </p>
                    <ul className="flex flex-col gap-0.5">
                      {corridor.knownBottlenecks.map((b) => (
                        <li
                          key={b}
                          className="text-xs text-muted-foreground pl-3 before:content-['•'] before:mr-1.5 before:text-amber-400"
                        >
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Coverage stats */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="flex flex-col items-center rounded-md bg-muted/30 p-2">
                    <span className="font-mono text-lg font-semibold">
                      {corridor.coverage.journalEntries}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Entries
                    </span>
                  </div>
                  <div className="flex flex-col items-center rounded-md bg-muted/30 p-2">
                    <span className="font-mono text-lg font-semibold">
                      {corridor.coverage.siteVisits}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Site Visits
                    </span>
                  </div>
                  <div className="flex flex-col items-center rounded-md bg-muted/30 p-2">
                    <span className="font-mono text-lg font-semibold">
                      {corridor.coverage.contacts}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Contacts
                    </span>
                  </div>
                </div>

                {/* Recommendations */}
                {corridor.recommendations.length > 0 && (
                  <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                    <p className="text-xs font-medium text-primary mb-1">
                      Recommendations
                    </p>
                    {corridor.recommendations.map((r, i) => (
                      <p
                        key={i}
                        className="text-xs text-muted-foreground leading-relaxed"
                      >
                        {r}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

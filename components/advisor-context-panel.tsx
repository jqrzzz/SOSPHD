import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { ContextSnapshot } from "@/lib/data/advisor-types";

interface ContextPanelProps {
  context: ContextSnapshot;
}

export function AdvisorContextPanel({ context }: ContextPanelProps) {
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3 p-3">
        {/* Cases overview */}
        <Card className="bg-card border-border">
          <CardHeader className="px-3 py-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active Cases
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-foreground">
                {context.total_cases}
              </span>
              <span className="text-xs text-muted-foreground">total</span>
            </div>
            <div className="mt-2 flex gap-2">
              {(["open", "active", "closed"] as const).map((s) => {
                const count = context.recent_cases.filter(
                  (c) => c.status === s,
                ).length;
                return (
                  <Badge
                    key={s}
                    variant="secondary"
                    className="text-[10px] font-mono"
                  >
                    {s}: {count}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Missing milestones */}
        <Card className="bg-card border-border">
          <CardHeader className="px-3 py-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Missing Milestones
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {context.missing_milestones_all.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                All cases have complete milestone chains.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {context.missing_milestones_all.map((m) => (
                  <div key={m.case_id} className="flex flex-col gap-1">
                    <span className="font-mono text-xs font-medium text-foreground">
                      {m.patient_ref}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {m.missing.map((evt) => (
                        <Badge
                          key={evt}
                          variant="outline"
                          className="text-[9px] font-mono text-destructive border-destructive/30"
                        >
                          {evt}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Top tasks */}
        <Card className="bg-card border-border">
          <CardHeader className="px-3 py-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Top Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {context.top_tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tasks yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {context.top_tasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start gap-2 text-xs"
                  >
                    <Badge
                      variant={
                        t.status === "done"
                          ? "default"
                          : t.status === "doing"
                            ? "secondary"
                            : "outline"
                      }
                      className="mt-0.5 shrink-0 text-[9px] font-mono"
                    >
                      {t.status}
                    </Badge>
                    <span className="leading-relaxed text-foreground">
                      {t.title}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-muted-foreground">
                      P{t.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent notes */}
        <Card className="bg-card border-border">
          <CardHeader className="px-3 py-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {context.recent_notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No notes yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {context.recent_notes.map((n) => (
                  <div key={n.id} className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-foreground">
                      {n.title ?? "(untitled)"}
                    </span>
                    <span className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                      {n.content}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

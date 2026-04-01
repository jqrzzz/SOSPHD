import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { executeAgent } from "@/lib/agent/core";
import { suggestNextActions } from "@/lib/agent";

interface DigestData {
  period: { from: string; to: string };
  activity: {
    newJournalEntries: number;
    newNotes: number;
    tasksCompleted: number;
    tasksOpen: number;
  };
  highlights: Array<{
    type: string;
    title: string;
    corridor: string | null;
    date: string;
  }>;
  urgentTasks: Array<{ title: string; due: string | null }>;
}

export default async function WeeklyDigestPage() {
  const [digestResponse, actions] = await Promise.all([
    executeAgent({ action: "weekly_digest" }),
    suggestNextActions(3),
  ]);

  const digest = digestResponse.data as DigestData;
  const activity = digest?.activity;

  const periodFrom = digest?.period?.from
    ? new Date(digest.period.from).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "N/A";
  const periodTo = digest?.period?.to
    ? new Date(digest.period.to).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "N/A";

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Weekly Digest</h1>
        <p className="text-sm text-muted-foreground">
          {periodFrom} — {periodTo}
        </p>
      </header>

      <div className="flex flex-col gap-6 p-6">
        {/* Activity summary */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Journal Entries"
            value={activity?.newJournalEntries ?? 0}
            sub="this week"
          />
          <StatCard
            label="Notes Added"
            value={activity?.newNotes ?? 0}
            sub="this week"
          />
          <StatCard
            label="Tasks Completed"
            value={activity?.tasksCompleted ?? 0}
            sub="done"
            color="text-emerald-400"
          />
          <StatCard
            label="Tasks Open"
            value={activity?.tasksOpen ?? 0}
            sub="remaining"
            color="text-amber-400"
          />
        </div>

        {/* Urgent tasks */}
        {digest?.urgentTasks && digest.urgentTasks.length > 0 && (
          <Card className="border-red-500/20">
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-red-400">
                Urgent Tasks (P1)
              </h2>
              <div className="flex flex-col gap-2">
                {digest.urgentTasks.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2"
                  >
                    <span className="text-sm text-foreground">{t.title}</span>
                    {t.due && (
                      <span className="text-xs text-muted-foreground font-mono">
                        Due:{" "}
                        {new Date(t.due).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* What to do next */}
        {actions.length > 0 && (
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-primary">
                What To Do Next
              </h2>
              <div className="flex flex-col gap-2">
                {actions.map((action, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-md border border-border/50 px-3 py-2"
                  >
                    <span
                      className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
                        action.severity === "high"
                          ? "bg-red-400"
                          : action.severity === "medium"
                            ? "bg-amber-400"
                            : "bg-muted-foreground"
                      }`}
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-foreground">
                        {action.action}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {action.area}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Highlights */}
        {digest?.highlights && digest.highlights.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                This Week&apos;s Highlights
              </h2>
              <div className="flex flex-col gap-2">
                {digest.highlights.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-sm"
                  >
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {h.type}
                    </Badge>
                    <span className="text-foreground">{h.title}</span>
                    {h.corridor && (
                      <span className="ml-auto text-xs text-primary/80">
                        {h.corridor}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground font-mono shrink-0">
                      {new Date(h.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {(!digest?.highlights || digest.highlights.length === 0) &&
          (!digest?.urgentTasks || digest.urgentTasks.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No activity this week yet. Start by adding a journal entry or note.
              </p>
            </div>
          )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number;
  sub: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span
          className={`font-mono text-2xl font-semibold tabular-nums ${color ?? "text-foreground"}`}
        >
          {value}
        </span>
        <span className="text-xs text-muted-foreground">{sub}</span>
      </CardContent>
    </Card>
  );
}

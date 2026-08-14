import {
  getCaseBreakdowns,
  getMissingnessReport,
  getMonthlyVolume,
} from "@/lib/data/analytics";
import {
  CoverageMeters,
  MonthlyColumns,
  RankedBars,
} from "@/components/stat-charts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Known registry recording gaps (see docs/paper1-baseline-findings.md §2):
// zero/near-zero months that are capture failures, not demand troughs.
const RECORDING_GAP_MONTHS = ["2019-07", "2019-02"];

export default async function StatisticsPage() {
  const [monthly, breakdowns, missingness] = await Promise.all([
    getMonthlyVolume(),
    getCaseBreakdowns(),
    getMissingnessReport(),
  ]);

  const nationalityCount = breakdowns.by_nationality.filter(
    (n) => n.label !== "Unknown",
  ).length;
  const payerCount = breakdowns.by_payer.filter(
    (p) => p.label !== "Unknown",
  ).length;
  const selfPay = breakdowns.by_payer.find((p) => p.label === "Self-pay");

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Statistics</h1>
        <p className="text-sm text-muted-foreground">
          The research registry in numbers. Historical baseline Dec 2018 – Mar
          2020 plus research-native cases; freeze a snapshot before citing.
        </p>
      </header>

      <div className="flex flex-col gap-6 p-6">
        {/* Hero figure + stat tiles */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="sm:col-span-2 lg:col-span-1">
            <CardContent className="flex flex-col justify-center gap-1 p-5">
              <span className="text-5xl font-semibold tracking-tight text-foreground">
                {breakdowns.total_cases.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">
                de-identified cases
              </span>
            </CardContent>
          </Card>
          <StatTile
            label="Nationalities"
            value={nationalityCount}
            sub="tourist origins"
          />
          <StatTile
            label="Payer entities"
            value={payerCount}
            sub={
              selfPay
                ? `self-pay largest: ${selfPay.count}`
                : "after normalization"
            }
          />
          <StatTile
            label="Evacuations"
            value={breakdowns.evacuated_count}
            sub="TTTA-relevant subgroup"
          />
          <StatTile
            label="Complete provenance"
            value={missingness.complete_cases}
            sub="cases with all milestones"
          />
        </section>

        {/* Monthly volume */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Cases per month</CardTitle>
            <CardDescription className="text-xs">
              High-season signature (Nov–Feb). Red baseline ticks are known
              recording gaps — capture failures, not demand troughs. Registry
              ends at the Mar 2020 border closure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyColumns data={monthly} gapMonths={RECORDING_GAP_MONTHS} />
          </CardContent>
        </Card>

        {/* Breakdown grid */}
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Diagnosis mix</CardTitle>
              <CardDescription className="text-xs">
                Keyword-bucketed from clinical free text
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RankedBars
                items={breakdowns.by_diagnosis}
                total={breakdowns.total_cases}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Top nationalities</CardTitle>
              <CardDescription className="text-xs">
                Long tail across {nationalityCount} countries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RankedBars
                items={breakdowns.by_nationality.filter(
                  (n) => n.label !== "Unknown",
                )}
                total={breakdowns.total_cases}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Who pays</CardTitle>
              <CardDescription className="text-xs">
                Extreme fragmentation — no insurer above 4% — is the structural
                argument for a coordination layer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RankedBars
                items={breakdowns.by_payer.filter((p) => p.label !== "Unknown")}
                total={breakdowns.total_cases}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Corridors</CardTitle>
              <CardDescription className="text-xs">
                Derived from recorded province/branch keywords — the baseline is
                effectively single-corridor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RankedBars
                items={breakdowns.by_corridor}
                total={breakdowns.total_cases}
                limit={8}
              />
            </CardContent>
          </Card>
        </section>

        {/* Milestone coverage — the Paper 1 finding */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Milestone coverage</CardTitle>
            <CardDescription className="text-xs">
              The Paper 1 result: {missingness.complete_cases} of{" "}
              {missingness.total_cases} cases carry every coordination
              milestone — the timestamps the field needs do not exist in
              retrospective data and must be captured prospectively.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CoverageMeters
              items={missingness.by_milestone.map((m) => ({
                label: m.event_type,
                present: m.present,
                total: missingness.total_cases,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col justify-center gap-1 p-5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {value.toLocaleString()}
        </span>
        <span className="text-[11px] text-muted-foreground">{sub}</span>
      </CardContent>
    </Card>
  );
}

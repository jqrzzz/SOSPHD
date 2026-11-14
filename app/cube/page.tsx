import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { CubeExplorer } from "@/components/cube/cube-explorer";
import { CUBE_SPEC_VERSION, type QuestionKey } from "@/lib/cube/language";
import { placeOf, questionOf } from "@/lib/cube/places";
import { CLOCKS, clockPlace, phdFindings } from "@/lib/cube/phd";

export const metadata = {
  title: "The Cube",
  description:
    "The six questions every tourist emergency asks, and where the PhD's instrument looks among them.",
};

/**
 * The Cube — the PhD read through the Case Cube's framework. The six
 * questions and the places where they meet, with the event spine, the
 * three clocks and Paper 2's categories placed on them, so what the
 * instrument can and cannot see is a picture rather than a claim. The
 * cube itself, with Terra's rules and test sets, stays in Tourist SOS's
 * private tools; this page links to them.
 */

/** Private to the owner on Claude; nobody else can open them. */
const PRIVATE_CUBES = [
  {
    name: "Case Cube",
    where: "Tourist SOS Vision, The Cube tab",
    what: "Terra's rules, the imagined cases and the four rounds, from reaching care to getting paid.",
    href: "https://claude.ai/artifact/QVa9xg8BsBevStYAENLpgH",
  },
  {
    name: "Thinking Cube",
    where: "Its own page",
    what: "Put any thought, question or finding on the 29 places and see what it touches.",
    href: "https://claude.ai/artifact/P89uyU9e5X6RZzfmvpE6bS",
  },
];

function names(keys: QuestionKey[], joiner: "and" | "or"): string {
  const n = keys.map((k) => questionOf(k).name);
  return n.length < 2 ? n.join("") : `${n.slice(0, -1).join(", ")} ${joiner} ${n[n.length - 1]}`;
}

export default function CubePage() {
  const f = phdFindings();
  const findings = [
    {
      value: `${f.clockPlaces.length} of ${f.places}`,
      text: `places have a clock. ${CLOCKS.map((c) => `${c.abbr} stops at ${placeOf(clockPlace(c)).name}`).join(", ")}.`,
    },
    {
      value: `${f.questionsReached.length} of ${f.questionsReached.length + f.questionsUnseen.length}`,
      text: `questions reach the event spine. ${names(f.questionsUnseen, "and")} have no event.`,
    },
    {
      value: `${f.decisionsTouchingUnseen} of ${f.decisions}`,
      text: `big decisions involve ${names(f.questionsUnseen, "or")}, so their delays reach the clocks with no recorded cause.`,
    },
    {
      value: `${f.recommendable.length} of ${f.recommendable.length + f.notRecommendable.length}`,
      text: `questions Paper 2's engine can recommend on. Nothing yet for ${names(f.notRecommendable, "or")}.`,
    },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        eyebrow="Framework"
        title="The Cube"
        description="Every tourist emergency asks six questions, and each answer depends on others. This shows where the PhD's instrument looks among them, and where it can't see yet."
      />

      <div className="flex flex-col gap-8 p-4 sm:p-6">
        <CubeExplorer />

        <section className="flex flex-col gap-3" aria-labelledby="sees">
          <div className="flex flex-col gap-1">
            <h2 id="sees" className="text-sm font-semibold text-foreground">
              What the instrument sees
            </h2>
            <p className="text-xs text-muted-foreground">
              Counted from the event spine, the clocks and Paper 2&apos;s categories, so these change when the instrument does.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {findings.map((x) => (
              <Card key={x.text}>
                <CardContent className="flex flex-col gap-1.5 p-4">
                  <span className="font-mono text-2xl font-semibold tracking-tight text-foreground">{x.value}</span>
                  <p className="text-xs leading-relaxed text-muted-foreground">{x.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="full">
          <div className="flex flex-col gap-1">
            <h2 id="full" className="text-sm font-semibold text-foreground">
              The full cubes
            </h2>
            <p className="text-xs text-muted-foreground">On Claude, private to you.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {PRIVATE_CUBES.map((c) => (
              <a key={c.name} href={c.href} target="_blank" rel="noopener noreferrer" className="group">
                <Card className="h-full transition-colors group-hover:border-primary/50">
                  <CardContent className="flex h-full flex-col gap-1.5 p-4">
                    <span className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground">
                      {c.name}
                      <span aria-hidden="true" className="text-muted-foreground transition-colors group-hover:text-primary">
                        ↗
                      </span>
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{c.where}</span>
                    <p className="text-xs leading-relaxed text-muted-foreground">{c.what}</p>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </section>

        <p className="font-mono text-[10px] text-muted-foreground/70">
          Words from the Case Cube, spec {CUBE_SPEC_VERSION}. Where each event sits is a reading of the instrument, yours to confirm or move.
        </p>
      </div>
    </div>
  );
}

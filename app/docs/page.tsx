import Link from "next/link";
import { getDocs, getAllTags } from "@/lib/data/docs-store";
import { DocListFilters } from "@/components/doc-list-filters";
import { PageHeader } from "@/components/page-header";
import { CountUp } from "@/components/motion/count-up";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_STYLES: Record<string, string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  draft: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  archived: "border-border bg-muted/30 text-muted-foreground",
};

export default async function DocsPage(props: {
  searchParams: Promise<{ folder?: string; q?: string; tag?: string }>;
}) {
  const searchParams = await props.searchParams;
  const folderFilter = searchParams.folder;
  const searchQuery = searchParams.q;
  const tagFilter = searchParams.tag;

  const docs = await getDocs({
    folder: folderFilter,
    search: searchQuery,
    tag: tagFilter,
  });

  const allTags = await getAllTags();

  const folders = new Set(docs.map((d) => d.folder));
  const activeCount = docs.filter((d) => d.status === "active").length;
  const draftCount = docs.filter((d) => d.status === "draft").length;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* No-PHI banner */}
      <div
        className="flex items-center gap-2 border-b border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5"
        role="status"
      >
        <span className="text-[11px] leading-tight text-emerald-200/90">
          Documents workspace — no PHI stored or processed. Safe for research
          writing.
        </span>
        <Badge
          variant="outline"
          className="ml-auto shrink-0 border-emerald-500/30 bg-emerald-500/10 font-mono text-[9px] tracking-[0.12em] text-emerald-300"
        >
          NO-PHI
        </Badge>
      </div>

      <PageHeader
        eyebrow="Research artefacts"
        title="Documents"
        description="Papers, field logs, methods notes, and protocols. Each doc lives in a folder, carries tags, and keeps a version history."
        actions={
          <Button asChild size="sm">
            <Link href="/docs/new">
              <span className="mr-1 text-base leading-none">+</span> New
              document
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-5 p-4 sm:p-6">
        <FadeIn>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile
              label="Total"
              value={<CountUp value={docs.length} duration={1} />}
            />
            <StatTile
              label="Active"
              value={
                <span className="text-emerald-400">
                  <CountUp value={activeCount} duration={1} />
                </span>
              }
            />
            <StatTile
              label="Draft"
              value={
                <span className="text-amber-400">
                  <CountUp value={draftCount} duration={1} />
                </span>
              }
            />
            <StatTile
              label="Folders"
              value={<CountUp value={folders.size} duration={1} />}
            />
          </div>
        </FadeIn>

        {/* Filters */}
        <DocListFilters
          currentFolder={folderFilter}
          currentSearch={searchQuery}
          currentTag={tagFilter}
          availableTags={allTags}
        />

        {/* Doc grid */}
        {docs.length === 0 ? (
          <FadeIn>
            <Card className="surface-lifted">
              <CardContent className="flex flex-col items-center gap-5 py-16">
                <div className="relative">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 rounded-2xl bg-primary/15 blur-2xl"
                  />
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/5 font-mono text-2xl text-primary/80">
                    ✎
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {folderFilter || searchQuery || tagFilter
                      ? "No documents match those filters."
                      : "No documents yet."}
                  </p>
                  <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                    {folderFilter || searchQuery || tagFilter
                      ? "Try clearing the filters or a different keyword."
                      : "Start a paper, log, or methods note. Versions are tracked automatically."}
                  </p>
                </div>
                {!folderFilter && !searchQuery && !tagFilter && (
                  <Button asChild size="sm">
                    <Link href="/docs/new">Create first document</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </FadeIn>
        ) : (
          <StaggerContainer
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
            stagger={0.04}
          >
            {docs.map((d) => (
              <StaggerItem key={d.id}>
                <Link href={`/docs/${d.id}`} className="block h-full">
                  <Card className="lift group flex h-full flex-col">
                    <CardContent className="flex flex-1 flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                            {d.folder}
                          </span>
                          <h3 className="line-clamp-2 text-balance text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
                            {d.title}
                          </h3>
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 font-mono text-[9.5px] uppercase tracking-[0.08em] ${
                            STATUS_STYLES[d.status] ?? STATUS_STYLES.draft
                          }`}
                        >
                          {d.status}
                        </Badge>
                      </div>

                      {d.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {d.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center rounded-md border border-border/50 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/80"
                            >
                              {tag}
                            </span>
                          ))}
                          {d.tags.length > 4 && (
                            <span className="font-mono text-[10px] text-muted-foreground/60">
                              +{d.tags.length - 4}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-auto flex items-center justify-between border-t border-border/40 pt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                        <span>Updated {formatDate(d.updated_at, "short")}</span>
                        <span className="text-primary/80 transition-transform group-hover:translate-x-0.5">
                          Open →
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-card/40 p-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </span>
    </div>
  );
}

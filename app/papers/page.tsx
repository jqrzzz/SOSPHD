import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getPaperOverviews } from "@/lib/data/docs-store";
import { readingMinutes, wordCount } from "@/lib/markdown";
import { formatDate } from "@/lib/utils";

export const metadata = {
  title: "Papers · SOSPHD",
  description: "The thesis papers — drafts, versions, and open annotations.",
};

/**
 * Papers — the front door to the thesis itself. Docs holds everything
 * (field logs, methods notes, protocols); this surface is only the
 * papers, so the work being written is never more than one click away.
 */
export default async function PapersPage() {
  const papers = await getPaperOverviews();

  const totalWords = papers.reduce(
    (sum, p) => sum + wordCount(p.doc.content_md),
    0,
  );
  const totalOpen = papers.reduce((sum, p) => sum + p.open_annotations, 0);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        eyebrow="The thesis"
        title="Papers"
        description="Every paper in the program, with its current draft, version history, and the annotations waiting to be addressed. Open one to read it; select a passage to annotate."
      />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {papers.length > 0 && (
          <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
            <span>
              <span className="font-mono text-sm text-foreground">
                {papers.length}
              </span>{" "}
              papers
            </span>
            <span>
              <span className="font-mono text-sm text-foreground">
                {totalWords.toLocaleString()}
              </span>{" "}
              words written
            </span>
            <span>
              <span className="font-mono text-sm text-foreground">
                {totalOpen}
              </span>{" "}
              open annotations
            </span>
          </div>
        )}

        {papers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-sm font-medium text-foreground">
                No papers yet.
              </p>
              <p className="max-w-md text-xs text-muted-foreground">
                Papers are documents in the{" "}
                <span className="font-mono">Papers</span> folder. Create one in
                Docs, or ask the research agent to draft one.
              </p>
              <Link
                href="/docs/new"
                className="mt-2 text-xs text-primary underline underline-offset-2"
              >
                New document →
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {papers.map(({ doc, version_count, open_annotations }) => {
              const words = wordCount(doc.content_md);
              return (
                <Link key={doc.id} href={`/docs/${doc.id}`} className="group">
                  <Card className="h-full transition-colors group-hover:border-primary/50">
                    <CardContent className="flex h-full flex-col gap-3 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-sm font-semibold leading-snug text-foreground">
                          {doc.title}
                        </h2>
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px] capitalize"
                        >
                          {doc.status}
                        </Badge>
                      </div>

                      <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        {firstProse(doc.content_md)}
                      </p>

                      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 font-mono text-[10px] text-muted-foreground">
                        <span>{words.toLocaleString()} words</span>
                        <span>~{readingMinutes(doc.content_md)} min</span>
                        <span>
                          {version_count} version{version_count === 1 ? "" : "s"}
                        </span>
                        {open_annotations > 0 && (
                          <span className="text-primary">
                            {open_annotations} open note
                            {open_annotations === 1 ? "" : "s"}
                          </span>
                        )}
                        <span className="ml-auto">
                          {formatDate(doc.updated_at, "short")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** First real prose line of a doc, for the card preview. */
function firstProse(md: string): string {
  const line = md
    .split("\n")
    .map((l) => l.trim())
    .find(
      (l) =>
        l.length > 0 &&
        !l.startsWith("#") &&
        !l.startsWith("|") &&
        !l.startsWith("-") &&
        !l.startsWith("```"),
    );
  return line ? line.replace(/[*`]/g, "") : "No content yet.";
}

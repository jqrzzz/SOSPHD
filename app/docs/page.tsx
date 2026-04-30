import Link from "next/link";
import { getDocs, getAllTags } from "@/lib/data/docs-store";
import { DocListFilters } from "@/components/doc-list-filters";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

  return (
    <div className="flex flex-1 flex-col">
      {/* No-PHI banner */}
      <div
        className="flex items-center gap-2 border-b border-[hsl(142_71%_45%)]/20 bg-[hsl(142_71%_45%)]/5 px-4 py-1.5"
        role="status"
      >
        <span className="text-[11px] leading-tight text-[hsl(142_71%_45%)]">
          Documents workspace -- no PHI is stored or processed here. Safe for research writing.
        </span>
        <Badge
          variant="outline"
          className="ml-auto shrink-0 border-[hsl(142_71%_45%)]/30 font-mono text-[9px] text-[hsl(142_71%_45%)]"
        >
          NO-PHI
        </Badge>
      </div>

      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">
            {docs.length} document{docs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/docs/new">New Document</Link>
        </Button>
      </header>

      {/* Filters */}
      <DocListFilters
        currentFolder={folderFilter}
        currentSearch={searchQuery}
        currentTag={tagFilter}
        availableTags={allTags}
      />

      {/* Table */}
      <div className="flex-1 overflow-auto px-3 pb-6 sm:px-6">
        {docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary">
              <span className="text-2xl text-muted-foreground">+</span>
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-sm font-medium text-foreground">
                {folderFilter || searchQuery || tagFilter ? "No documents match your filters" : "No documents yet"}
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                {folderFilter || searchQuery || tagFilter
                  ? "Try adjusting your filters."
                  : "Create a document to start writing papers, field logs, or research notes."}
              </p>
            </div>
            {!folderFilter && !searchQuery && !tagFilter && (
              <Button asChild size="sm">
                <Link href="/docs/new">Create First Document</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="w-28 hidden sm:table-cell">Folder</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-44 hidden md:table-cell">Tags</TableHead>
                <TableHead className="w-36 hidden sm:table-cell">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => (
                <TableRow key={d.id} className="group">
                  <TableCell>
                    <Link
                      href={`/docs/${d.id}`}
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {d.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                    {d.folder}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        d.status === "active"
                          ? "border-[hsl(var(--status-closed))]/30 text-[hsl(var(--status-closed))]"
                          : d.status === "archived"
                            ? "border-muted-foreground/30 text-muted-foreground"
                            : "border-[hsl(var(--status-active))]/30 text-[hsl(var(--status-active))]"
                      }
                    >
                      {d.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {d.tags.slice(0, 3).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {d.tags.length > 3 && (
                        <Badge variant="secondary" className="text-[10px]">
                          +{d.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground font-tabular hidden sm:table-cell">
                    {formatDate(d.updated_at, "datetime")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </div>
    </div>
  );
}

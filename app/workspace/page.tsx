import { Suspense } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getNotes, getTasks } from "@/lib/data/advisor-store";
import { getUploads, getMindMaps } from "@/lib/data/workspace-store";
import { WorkspaceNotes } from "@/components/workspace-notes";
import { WorkspaceTasks } from "@/components/workspace-tasks";
import { WorkspaceUploads } from "@/components/workspace-uploads";
import { QuickLinks } from "@/components/quick-links";
import { PageHeader } from "@/components/page-header";
import { CountUp } from "@/components/motion/count-up";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger";
import { formatDate } from "@/lib/utils";

export default async function WorkspacePage() {
  const [notes, tasks, uploads, mindMaps] = await Promise.all([
    getNotes(50),
    getTasks({ limit: 50 }),
    getUploads(),
    getMindMaps(),
  ]);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        eyebrow="Bench"
        title="Workspace"
        description="Notes, tasks, uploads, and mind maps — your scratchpad for whatever doesn't yet belong in a doc or a case."
      />

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        <FadeIn>
          <QuickLinks />
        </FadeIn>

        {/* Mind Maps */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Mind maps
              <span className="ml-2 text-foreground/70">
                <CountUp value={mindMaps.length} duration={1} />
              </span>
            </h2>
            <Link href="/workspace/mindmap/new">
              <Button variant="outline" size="sm">
                <span className="mr-1 text-base leading-none">+</span> New map
              </Button>
            </Link>
          </div>
          {mindMaps.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-background/40 font-mono text-lg text-muted-foreground/60">
                  ◌
                </div>
                <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                  No mind maps yet. Sketch one to visualise relationships
                  between concepts, papers, methods, and data.
                </p>
              </CardContent>
            </Card>
          ) : (
            <StaggerContainer
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              stagger={0.04}
            >
              {mindMaps.map((mm) => (
                <StaggerItem key={mm.id}>
                  <Link href={`/workspace/mindmap/${mm.id}`} className="block">
                    <Card className="lift group h-full">
                      <CardContent className="flex flex-col gap-1.5 p-4">
                        <h3 className="text-balance text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
                          {mm.title}
                        </h3>
                        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                          <span className="tabular-nums text-foreground/80">
                            {mm.nodes.length}
                          </span>{" "}
                          nodes ·{" "}
                          <span className="tabular-nums text-foreground/80">
                            {mm.edges.length}
                          </span>{" "}
                          edges
                        </p>
                        <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60">
                          Updated {formatDate(mm.updated_at, "short")}
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
        </div>

        {/* Tabs for notes / tasks / uploads */}
        <Tabs defaultValue="notes" className="flex flex-1 flex-col">
          <TabsList className="w-fit">
            <TabsTrigger value="notes">Notes · {notes.length}</TabsTrigger>
            <TabsTrigger value="tasks">Tasks · {tasks.length}</TabsTrigger>
            <TabsTrigger value="uploads">
              Uploads · {uploads.length}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="mt-4">
            <Suspense
              fallback={
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Loading notes…
                </div>
              }
            >
              <WorkspaceNotes initialNotes={notes} />
            </Suspense>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <Suspense
              fallback={
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Loading tasks…
                </div>
              }
            >
              <WorkspaceTasks initialTasks={tasks} />
            </Suspense>
          </TabsContent>

          <TabsContent value="uploads" className="mt-4">
            <Suspense
              fallback={
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Loading uploads…
                </div>
              }
            >
              <WorkspaceUploads initialUploads={uploads} />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

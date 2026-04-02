import { Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getNotes, getTasks } from "@/lib/data/advisor-store";
import { getUploads, getMindMaps } from "@/lib/data/workspace-store";
import { WorkspaceNotes } from "@/components/workspace-notes";
import { WorkspaceTasks } from "@/components/workspace-tasks";
import { WorkspaceUploads } from "@/components/workspace-uploads";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QuickLinks } from "@/components/quick-links";

export default async function WorkspacePage() {
  const notes = await getNotes(50);
  const tasks = await getTasks({ limit: 50 });
  const uploads = await getUploads();
  const mindMaps = await getMindMaps();

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Workspace</h1>
          <p className="text-sm text-muted-foreground">
            Notes, tasks, uploads, and mind maps in one place
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Quick Links */}
        <QuickLinks />

        {/* Mind Maps quick access */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Mind Maps</h2>
            <Link href="/workspace/mindmap/new">
              <Button variant="outline" size="sm">New Map</Button>
            </Link>
          </div>
          {mindMaps.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">
                  No mind maps yet. Create one to visualize your research concepts.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {mindMaps.map((mm) => (
                <Link key={mm.id} href={`/workspace/mindmap/${mm.id}`}>
                  <Card className="transition-colors hover:border-primary/50">
                    <CardContent className="flex flex-col gap-1 p-4">
                      <h3 className="text-sm font-medium text-foreground">{mm.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {mm.nodes.length} node{mm.nodes.length !== 1 ? "s" : ""} &middot;{" "}
                        {mm.edges.length} connection{mm.edges.length !== 1 ? "s" : ""}
                      </p>
                      <span className="text-xs text-muted-foreground font-mono">
                        Updated {formatDate(mm.updated_at, "short")}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Tabs for notes/tasks/uploads */}
        <Tabs defaultValue="notes" className="flex flex-1 flex-col">
          <TabsList className="w-fit">
            <TabsTrigger value="notes">
              Notes ({notes.length})
            </TabsTrigger>
            <TabsTrigger value="tasks">
              Tasks ({tasks.length})
            </TabsTrigger>
            <TabsTrigger value="uploads">
              Uploads ({uploads.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="mt-4">
            <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">Loading notes...</div>}>
              <WorkspaceNotes initialNotes={notes} />
            </Suspense>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">Loading tasks...</div>}>
              <WorkspaceTasks initialTasks={tasks} />
            </Suspense>
          </TabsContent>

          <TabsContent value="uploads" className="mt-4">
            <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">Loading uploads...</div>}>
              <WorkspaceUploads initialUploads={uploads} />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

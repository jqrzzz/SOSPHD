import { notFound } from "next/navigation";
import { getMindMapById } from "@/lib/data/workspace-store";
import { MindMapCanvas } from "@/components/mind-map-canvas";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function MindMapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mindMap = getMindMapById(id);

  if (!mindMap) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <Link href="/workspace">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            &larr; Workspace
          </Button>
        </Link>
      </div>
      <MindMapCanvas
        id={mindMap.id}
        title={mindMap.title}
        initialNodes={mindMap.nodes}
        initialEdges={mindMap.edges}
      />
    </div>
  );
}

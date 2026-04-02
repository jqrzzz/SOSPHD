import { notFound } from "next/navigation";
import { getDocById, getVersionsByDocId } from "@/lib/data/docs-store";
import { getCases } from "@/lib/data/store";
import { DocEditor } from "@/components/doc-editor";
import { DocAITools } from "@/components/doc-ai-tools";
import { DocVersions } from "@/components/doc-versions";
import { Badge } from "@/components/ui/badge";

export default async function DocDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const doc = await getDocById(params.id);

  if (!doc) {
    notFound();
  }

  const [versions, cases] = await Promise.all([
    getVersionsByDocId(doc.id),
    getCases(),
  ]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* No-PHI banner */}
      <div
        className="flex items-center gap-2 border-b border-[hsl(142_71%_45%)]/20 bg-[hsl(142_71%_45%)]/5 px-4 py-1.5"
        role="status"
      >
        <span className="text-[11px] leading-tight text-[hsl(142_71%_45%)]">
          Document workspace -- no PHI stored or processed. Safe for research writing.
        </span>
        <Badge
          variant="outline"
          className="ml-auto shrink-0 border-[hsl(142_71%_45%)]/30 font-mono text-[9px] text-[hsl(142_71%_45%)]"
        >
          NO-PHI
        </Badge>
      </div>

      {/* Two-column layout: editor + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main editor */}
        <DocEditor doc={doc} cases={cases} />

        {/* Right sidebar: AI tools + versions */}
        <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-auto border-l border-border bg-card/50 p-4">
          <DocAITools docId={doc.id} />
          <DocVersions docId={doc.id} versions={versions} />
        </aside>
      </div>
    </div>
  );
}

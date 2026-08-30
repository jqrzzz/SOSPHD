import { notFound } from "next/navigation";
import {
  getAnnotationsByDocId,
  getDocById,
  getVersionsByDocId,
} from "@/lib/data/docs-store";
import { getCases } from "@/lib/data/store";
import { DocWorkspace } from "@/components/doc-workspace";
import { DocAITools } from "@/components/doc-ai-tools";
import { DocAnnotations } from "@/components/doc-annotations";
import { DocVersions } from "@/components/doc-versions";
import { PhiWarning } from "@/components/phi-warning";

export default async function DocDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const doc = await getDocById(params.id);

  if (!doc) {
    notFound();
  }

  const [versions, cases, annotations] = await Promise.all([
    getVersionsByDocId(doc.id),
    getCases(),
    getAnnotationsByDocId(doc.id),
  ]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PhiWarning />

      {/* Two-column layout: editor + sidebar */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <DocWorkspace doc={doc} cases={cases} />

        <aside className="flex w-full shrink-0 flex-col gap-4 overflow-auto border-t border-border bg-card/50 p-4 lg:w-72 lg:border-l lg:border-t-0">
          <DocAnnotations docId={doc.id} annotations={annotations} />
          <DocAITools docId={doc.id} />
          <DocVersions docId={doc.id} versions={versions} />
        </aside>
      </div>
    </div>
  );
}

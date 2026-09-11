import Link from "next/link";
import { loadSectionRevisionAction } from "@/lib/doc-revision-actions";
import { DocSectionRevision } from "@/components/doc-section-revision";

export const dynamic = "force-dynamic";

export default async function SectionRevisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadSectionRevisionAction(id);
  if (!result.ok) return <div className="mx-auto max-w-2xl p-6">
    <h1 className="text-xl font-semibold">Revision workspace unavailable</h1>
    <p role="status" className="my-3 text-sm text-muted-foreground">{result.error}</p>
    <p className="mb-3 text-sm">No fallback manuscript is loaded and no document was changed.</p>
    <Link href="/docs" className="text-sm underline">Return to documents</Link>
  </div>;
  return <DocSectionRevision source={result.source} />;
}

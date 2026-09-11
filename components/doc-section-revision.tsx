"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveSectionRevisionAction } from "@/lib/doc-revision-actions";
import { manuscriptSections, replaceSection, MAX_REVISION_NOTE } from "@/lib/docs/section-revision";
import type { RevisionAnnotation, RevisionDoc } from "@/lib/docs/revision-service";

interface Proposal { replacement: string; note: string; requestId: string | null; savedId: string | null }
export interface SectionRevisionSource { doc: RevisionDoc; annotations: RevisionAnnotation[]; base_token: string }

export function DocSectionRevision({ source }: { source: SectionRevisionSource }) {
  const [selected, setSelected] = useState("");
  const [proposals, setProposals] = useState<Record<string, Proposal>>({});
  const [preview, setPreview] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const sections = manuscriptSections(source.doc.content_md);
  const section = sections.find((s) => s.key === selected);
  const original = section ? source.doc.content_md.slice(section.start, section.end) : "";
  const proposal = proposals[selected];
  const replacement = proposal?.replacement ?? original;
  const note = proposal?.note ?? "";
  const dirty = Object.entries(proposals).some(([key, p]) => {
    const part = sections.find((s) => s.key === key);
    return part && !p.savedId && p.replacement !== source.doc.content_md.slice(part.start, part.end);
  });
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function edit(replacementText: string, changeNote: string) {
    setProposals((all) => ({ ...all, [selected]: { replacement: replacementText, note: changeNote, requestId: null, savedId: null } }));
    setPreview(false); setReviewed(false); setMessage("");
  }
  function choose(key: string) {
    setSelected(key); setPreview(false); setReviewed(false); setMessage("");
  }
  let fullDraft = "";
  let validationError = "";
  if (section && replacement !== original) {
    try { fullDraft = replaceSection(source.doc.content_md, selected, replacement); }
    catch (error) { validationError = error instanceof Error ? error.message : "Invalid proposal."; }
  }
  function exportWork() {
    // Explicit private download only. No browser storage or external upload.
    const payload = {
      format: "sosphd-section-proposals-v1", source_id: source.doc.id,
      base_token: source.base_token, base_updated_at: source.doc.updated_at,
      base_title: source.doc.title, base_content_md: source.doc.content_md,
      proposals: Object.entries(proposals).map(([key, p]) => ({
        section_key: key, replacement: p.replacement, change_note: p.note, saved_doc_id: p.savedId,
      })),
      selected_full_draft_md: fullDraft || null,
      notice: "Private working proposal export, not a submission or database save. Review annotations remain on the source document.",
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "sosphd-section-proposals.json";
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function save() {
    if (inFlight.current || !section || !fullDraft || !preview || !reviewed || !note.trim()) return;
    const requestId = proposal?.requestId ?? crypto.randomUUID();
    const key = selected;
    const pending = { replacement, note, requestId, savedId: null };
    setProposals((all) => ({ ...all, [key]: pending }));
    inFlight.current = true;
    setMessage("");
    startTransition(async () => {
      try {
        const result = await saveSectionRevisionAction({
          source_id: source.doc.id, revision_id: requestId, base_token: source.base_token,
          section_key: key, replacement, note, reviewed: true,
        });
        if (!result.ok) { setMessage(result.error); return; }
        setProposals((all) => ({ ...all, [key]: { ...pending, savedId: result.doc_id } }));
        setMessage(result.replayed ? "Your earlier save was recovered. No duplicate draft was created." : "Full revised draft saved. The original and its review notes are unchanged.");
      } catch {
        setMessage("The save response was interrupted. Your proposal is still here. Retry the same save or export it; do not assume it was saved.");
      } finally { inFlight.current = false; }
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Manuscript revision</p>
          <h1 className="break-words text-2xl font-semibold">Revise a section</h1>
          <p className="mt-1 break-words text-sm text-muted-foreground">{source.doc.title}</p>
        </div>
        <Link href={`/docs/${source.doc.id}`} className="text-sm underline" onClick={(event) => {
          if (dirty && !window.confirm("Unsaved proposals are in this tab only. Export them before leaving. Leave now?")) event.preventDefault();
        }}>Back to original</Link>
      </header>
      <p className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
        The original stays unchanged. Review one section, then save a separate full draft with a recoverable starting version.
        Nothing is sent to an AI provider. Keep patient identifiers out of manuscript text.
      </p>
      {source.annotations.length > 0 && <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">Open review notes ({source.annotations.length})</summary>
        <div className="mt-3 flex flex-col gap-3">{source.annotations.map((a) => <div key={a.id} className="break-words border-t border-border pt-2 text-sm">
          {a.quote && <blockquote className="mb-1 whitespace-pre-wrap text-muted-foreground">{a.quote}</blockquote>}
          <p className="whitespace-pre-wrap">{a.comment}</p>
        </div>)}</div>
      </details>}
      <div className="flex flex-col gap-2">
        <label htmlFor="revision-section" className="text-sm font-medium">1. Choose the section</label>
        <select id="revision-section" value={selected} disabled={isPending} onChange={(event) => choose(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Select a Markdown section</option>
          {sections.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <p className="text-xs text-muted-foreground">Uses # headings. The selected heading stays fixed; its body can include subsections. No automatic renumbering or citation verification.</p>
        {!sections.length && <p role="status" className="text-sm">No supported headings found. This tool needs Markdown # headings; the original was not changed.</p>}
      </div>
      {section && <>
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <section className="min-w-0 rounded-lg border border-border p-3">
            <h2 className="mb-2 text-sm font-medium">Current section</h2>
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">{original || "(Empty body)"}</pre>
          </section>
          <section className="min-w-0 rounded-lg border border-border p-3">
            <label htmlFor="revision-replacement" className="mb-2 block text-sm font-medium">2. Write or paste the proposed replacement</label>
            <Textarea id="revision-replacement" value={replacement} disabled={isPending} onChange={(event) => edit(event.target.value, note)} className="min-h-80 resize-y font-mono text-sm" />
            <label htmlFor="revision-note" className="mb-1 mt-3 block text-sm font-medium">Why this change?</label>
            <Textarea id="revision-note" value={note} disabled={isPending} maxLength={MAX_REVISION_NOTE} onChange={(event) => edit(replacement, event.target.value)} placeholder="Describe the correction and its evidence." className="min-h-20 text-sm" />
          </section>
        </div>
        {validationError && <p role="alert" className="text-sm">{validationError}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={isPending || !fullDraft} onClick={() => { setPreview(true); setReviewed(false); }}>3. Preview full draft</Button>
          <Button type="button" variant="outline" disabled={isPending || !dirty} onClick={exportWork}>Export private working copy</Button>
        </div>
        {preview && fullDraft && <section className="rounded-lg border border-border p-3">
          <h2 className="text-sm font-medium">Full manuscript after this replacement</h2>
          <p className="my-2 text-xs text-muted-foreground">Only this section is applied. Proposals for other sections remain in this tab. Continue from the new draft to build sequential revisions.</p>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">{fullDraft}</pre>
          <label className="my-4 flex items-start gap-2 text-sm">
            <input type="checkbox" checked={reviewed} disabled={isPending} onChange={(event) => setReviewed(event.target.checked)} className="mt-1" />
            <span>I reviewed the full draft and relevant source review notes. Save as a new draft, not over the original.</span>
          </label>
          <Button type="button" disabled={isPending || !reviewed || !note.trim() || !!proposal?.savedId} onClick={save}>
            {isPending ? "Confirming save…" : proposal?.savedId ? "Saved as a new draft" : "Save full draft separately"}
          </Button>
        </section>}
      </>}
      {message && <p role="status" className="break-words rounded-lg border border-border p-3 text-sm">{message}</p>}
      {proposal?.savedId && <Link className="text-sm font-medium underline" href={`/docs/${proposal.savedId}/revise`} onClick={(event) => {
        if (dirty && !window.confirm("Other proposals remain unsaved in this tab. Export them before leaving. Continue now?")) event.preventDefault();
      }}>Open the saved draft and revise its next section</Link>}
      <p className="text-xs text-muted-foreground">Unsaved proposals stay in this tab only. Export before closing or reloading. A successful save is not scholarly approval.</p>
    </div>
  );
}

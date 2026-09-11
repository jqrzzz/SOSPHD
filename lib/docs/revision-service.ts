import { MAX_REVISION_NOTE, RevisionError, replaceSection, validateManuscript, manuscriptSections, utf8Bytes } from "./section-revision";

export interface RevisionDoc {
  id: string; user_id: string; title: string; content_md: string; updated_at: string;
  folder: string; tags: string[]; status: string; linked_case_id: string | null;
}
export interface RevisionAnnotation { id: string; quote: string; comment: string; resolved: boolean }
export interface RevisionVersion { id: string; doc_id: string; user_id: string; content_md: string; note: string }
export interface RevisionRequest {
  source_id: string; revision_id: string; base_token: string; section_key: string;
  replacement: string; note: string; reviewed: true;
}
export interface RevisionStore {
  readDoc(id: string): Promise<RevisionDoc | null>;
  readAnnotations(id: string): Promise<RevisionAnnotation[]>;
  readVersion(id: string): Promise<RevisionVersion | null>;
  insertVersion(row: RevisionVersion): Promise<void>;
  insertDoc(row: Omit<RevisionDoc, "updated_at"> & { slug: string }): Promise<void>;
}
export type Hash = (text: string) => string;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESERVED = "sosphd-revision:";

export function validDocId(id: unknown): id is string { return typeof id === "string" && UUID.test(id); }
export function parseRevisionRequest(input: unknown): RevisionRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new RevisionError("invalid_input", "Invalid revision request.");
  const r = input as Record<string, unknown>;
  const keys = ["source_id", "revision_id", "base_token", "section_key", "replacement", "note", "reviewed"];
  if (Object.keys(r).some((k) => !keys.includes(k)) || !validDocId(r.source_id) || !validDocId(r.revision_id) ||
    r.source_id.toLowerCase() === r.revision_id.toLowerCase() || typeof r.base_token !== "string" || !/^[a-f0-9]{64}$/.test(r.base_token) ||
    typeof r.section_key !== "string" || !/^\d{1,7}:\d{1,7}$/.test(r.section_key) ||
    typeof r.replacement !== "string" || typeof r.note !== "string" || !r.note.trim() || r.note.length > MAX_REVISION_NOTE || r.note.includes("\0") || r.reviewed !== true) {
    throw new RevisionError("invalid_input", "Review the section and provide a brief change note before saving.");
  }
  validateManuscript(r.replacement);
  utf8Bytes(r.note);
  return r as unknown as RevisionRequest;
}

export function revisionToken(doc: RevisionDoc, annotations: RevisionAnnotation[], hash: Hash): string {
  return hash(JSON.stringify({
    id: doc.id, owner: doc.user_id, title: doc.title, content: doc.content_md,
    updated_at: doc.updated_at, folder: doc.folder, tags: doc.tags, status: doc.status,
    linked_case_id: doc.linked_case_id,
    annotations: [...annotations].sort((a, b) => a.id.localeCompare(b.id)).map((a) => [a.id, a.quote, a.comment, a.resolved]),
  }));
}

export async function loadRevisionSource(store: RevisionStore, owner: string, id: string, hash: Hash) {
  if (!validDocId(id)) throw new RevisionError("invalid_input", "Invalid document identifier.");
  const doc = await store.readDoc(id);
  if (!doc || doc.user_id !== owner) throw new RevisionError("not_found", "Document not found or not accessible.");
  validateManuscript(doc.content_md);
  manuscriptSections(doc.content_md);
  const annotations = await store.readAnnotations(id);
  return { doc, annotations, base_token: revisionToken(doc, annotations, hash) };
}

/** Append-only sequence: archive the full base, then insert a separate full draft.
 * A partial failure may leave a harmless archive row, never an overwritten source.
 * Deterministic IDs make identical retries recoverable without upserts or duplicate drafts.
 */
export async function saveSectionDraft(store: RevisionStore, owner: string, input: unknown, hash: Hash) {
  const r = parseRevisionRequest(input);
  const requestHash = hash(JSON.stringify([r.source_id, r.revision_id, r.base_token, r.section_key, r.replacement, r.note]));
  const receiptTag = `${RESERVED}request:${requestHash}`;
  const archiveNote = `Before section revision ${r.revision_id}; request ${requestHash}. ${r.note}`;
  const versionMatches = (v: RevisionVersion | null) => v && v.doc_id === r.source_id && v.user_id === owner && v.note === archiveNote;

  async function recoverExisting(): Promise<{ doc_id: string; replayed: true } | null> {
    const existing = await store.readDoc(r.revision_id);
    if (!existing) return null;
    if (existing.user_id !== owner || !existing.tags.includes(receiptTag) || !existing.tags.includes(`${RESERVED}source:${r.source_id}`)) {
      throw new RevisionError("request_conflict", "This request ID is already in use. No document was overwritten.");
    }
    const version = await store.readVersion(r.revision_id);
    if (!versionMatches(version) || !version) throw new RevisionError("request_conflict", "The saved draft has no matching recoverable base version.");
    const expected = replaceSection(version.content_md, r.section_key, r.replacement);
    if (existing.content_md !== expected) throw new RevisionError("request_conflict", "The previously saved draft has changed. It was not overwritten.");
    return { doc_id: existing.id, replayed: true };
  }
  const replay = await recoverExisting();
  if (replay) return replay;
  const source = await loadRevisionSource(store, owner, r.source_id, hash);
  if (source.base_token !== r.base_token) throw new RevisionError("stale_source", "The source or its review notes changed. Export your proposal, then reload and review the new source.");
  const revised = replaceSection(source.doc.content_md, r.section_key, r.replacement);
  const archive: RevisionVersion = { id: r.revision_id, doc_id: r.source_id, user_id: owner, content_md: source.doc.content_md, note: archiveNote };
  const previousArchive = await store.readVersion(r.revision_id);
  if (previousArchive && (!versionMatches(previousArchive) || previousArchive.content_md !== archive.content_md)) {
    throw new RevisionError("request_conflict", "This request ID belongs to another saved base version.");
  }
  if (!previousArchive) {
    try { await store.insertVersion(archive); }
    catch {
      const found = await store.readVersion(r.revision_id);
      if (!versionMatches(found) || found?.content_md !== archive.content_md) throw new RevisionError("save_failed", "The base version could not be confirmed. No revised draft was created.");
    }
  }
  // Read-back before proceeding; a reported success must mean the base is recoverable.
  const confirmed = await store.readVersion(r.revision_id);
  if (!versionMatches(confirmed) || confirmed?.content_md !== archive.content_md) throw new RevisionError("save_failed", "The saved base version could not be verified. No revised draft was created.");
  const tags = [...source.doc.tags.filter((t) => !t.startsWith(RESERVED)), "agent", "section-revision",
    `${RESERVED}source:${r.source_id}`, `${RESERVED}base:${r.base_token}`, receiptTag];
  try {
    await store.insertDoc({
      id: r.revision_id, user_id: owner, title: `${source.doc.title} (section revision)`,
      slug: `revision-${r.revision_id}`, content_md: revised, folder: source.doc.folder,
      tags: [...new Set(tags)], status: "draft", linked_case_id: source.doc.linked_case_id,
    });
  } catch {
    const recovered = await recoverExisting();
    if (recovered) return recovered;
    throw new RevisionError("save_failed", "The revised draft could not be confirmed. Your source is unchanged; retry the same request or export your proposal.");
  }
  const saved = await recoverExisting();
  if (!saved) throw new RevisionError("save_failed", "The draft could not be read back. Retry the same request; do not assume it was saved.");
  return { doc_id: saved.doc_id, replayed: false };
}

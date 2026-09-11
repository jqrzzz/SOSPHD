import assert from "node:assert/strict";
import { createHash } from "node:crypto";

/** Synthetic fixtures only. Shared by Vitest and the local compiled-code runner. */
export function registerRevisionTests(test, api) {
  const { manuscriptSections, replaceSection, utf8Bytes, parseRevisionRequest, revisionToken, loadRevisionSource, saveSectionDraft } = api;
  const hash = (text) => createHash("sha256").update(text).digest("hex");
  const sourceId = "11111111-1111-4111-8111-111111111111";
  const draftId = "22222222-2222-4222-8222-222222222222";
  const owner = "owner";
  const original = "# Paper\n\n## Methods\n\nOriginal methods.\n\n### Scope\nKeep context.\n\n## Results\n\nNo observed results.\n";
  function fixture() {
    const docs = new Map([[sourceId, { id: sourceId, user_id: owner, title: "Synthetic paper", content_md: original,
      updated_at: "2026-09-11T00:00:00Z", folder: "Papers", tags: ["paper-1"], status: "active", linked_case_id: null }]]);
    const versions = new Map();
    let annotations = [{ id: "a", quote: "Original", comment: "Check source", resolved: false }];
    const calls = [];
    const store = {
      async readDoc(id) { calls.push(["readDoc", id]); return docs.get(id) ?? null; },
      async readVersion(id) { calls.push(["readVersion", id]); return versions.get(id) ?? null; },
      async readAnnotations(id) { calls.push(["annotations", id]); return annotations; },
      async insertVersion(row) { calls.push(["insertVersion", row]); if (versions.has(row.id)) throw Error("duplicate"); versions.set(row.id, structuredClone(row)); },
      async insertDoc(row) { calls.push(["insertDoc", row]); if (docs.has(row.id)) throw Error("duplicate"); docs.set(row.id, { ...structuredClone(row), updated_at: "2026-09-11T01:00:00Z" }); },
    };
    const request = { source_id: sourceId, revision_id: draftId, base_token: revisionToken(docs.get(sourceId), annotations, hash),
      section_key: manuscriptSections(original)[0].key, replacement: "\nRevised methods with source qualification.\n\n", note: "Clarify the unit of analysis.", reviewed: true };
    return { docs, versions, calls, store, request, setAnnotations: (value) => { annotations = value; } };
  }
  const errorCode = (code) => (error) => error?.code === code;
  test("sections preserve exact offsets and skip the document title", () => {
    const sections = manuscriptSections(original);
    assert.deepEqual(sections.map((s) => s.label), ["Methods", "Scope", "Results"]);
    assert.equal(original.slice(sections[0].start, sections[0].end), "\nOriginal methods.\n\n### Scope\nKeep context.\n\n");
  });
  test("revising a child preserves parent text and adjacent sections exactly", () => {
    const s = manuscriptSections(original)[1];
    const result = replaceSection(original, s.key, "New scope.");
    assert.ok(result.startsWith(original.slice(0, s.start)));
    assert.ok(result.endsWith(original.slice(s.end)));
    assert.ok(result.includes("New scope.\n\n## Results"));
  });
  test("duplicate heading labels remain distinct ranges", () => {
    const s = manuscriptSections("## Notes\nA\n## Notes\nB\n");
    assert.notEqual(s[0].key, s[1].key);
  });
  test("fenced code cannot create false section boundaries", () => {
    const text = "## A\n````md\n## fake\n```\n## still fake\n````\n## B\nY";
    assert.deepEqual(manuscriptSections(text).map((s) => s.label), ["A", "B"]);
  });
  test("tilde fences and HTML comments cannot create section boundaries", () => {
    const text = "## A\n~~~\n## fake\n~~~\n<!--\n## fake2\n-->\n## B\nY";
    assert.deepEqual(manuscriptSections(text).map((s) => s.label), ["A", "B"]);
  });
  test("unclosed code fences do not leak later headings", () => {
    assert.equal(manuscriptSections("## A\n```\n## fake").length, 1);
  });
  test("setext headings are not silently treated as supported", () => {
    assert.deepEqual(manuscriptSections("Title\n=====\nbody\n"), []);
  });
  test("CRLF text outside the chosen range stays exact", () => {
    const text = "## A\r\nOld\r\n## B\r\nRetained\r\n";
    const s = manuscriptSections(text)[0];
    assert.equal(replaceSection(text, s.key, "New"), "## A\r\nNew\r\n\r\n## B\r\nRetained\r\n");
  });
  test("empty last heading gets a line separator before a new body", () => {
    const text = "## Last";
    assert.equal(replaceSection(text, manuscriptSections(text)[0].key, "New body"), "## Last\nNew body");
  });
  test("Unicode before a section does not shift its replacement", () => {
    const text = "# ລາວ 🧭\n\n## Methods\nOld\n## End\nDone";
    const s = manuscriptSections(text)[0];
    const result = replaceSection(text, s.key, "New 🧪");
    assert.ok(result.startsWith("# ລາວ 🧭\n\n## Methods\n"));
    assert.ok(result.endsWith("## End\nDone"));
  });
  test("UTF-8 byte counts match Node including supplementary characters", () => {
    for (const text of ["", "abc", "é", "ລາວ", "🧪", "a\r\n🧪"]) assert.equal(utf8Bytes(text), Buffer.byteLength(text));
  });
  for (const replacement of ["", "   ", "\0", "a".repeat(128 * 1024 + 1), "\ud800"]) {
    test(`reject malformed or oversized replacement (${replacement.length} code units)`, () => {
      assert.throws(() => replaceSection(original, manuscriptSections(original)[0].key, replacement), errorCode("invalid_input"));
    });
  }
  test("unchanged proposal is rejected", () => {
    const s = manuscriptSections(original)[0];
    assert.throws(() => replaceSection(original, s.key, original.slice(s.start, s.end)), errorCode("invalid_input"));
  });
  test("arbitrary offset injection is rejected", () => assert.throws(() => replaceSection(original, "0:2", "X"), errorCode("invalid_input")));
  test("excessive manuscript and section count fail closed", () => {
    assert.throws(() => manuscriptSections("x".repeat(1024 * 1024 + 1)), errorCode("invalid_input"));
    assert.throws(() => manuscriptSections("## X\nY\n".repeat(501)), errorCode("invalid_input"));
  });
  for (const patch of [{ reviewed: false }, { note: "" }, { note: "n".repeat(2001) }, { source_id: "wrong" }, { revision_id: sourceId }, { base_token: "notahash" }, { unknown: true }, { section_key: "__proto__" }]) {
    test(`reject invalid request ${Object.keys(patch)[0]} ${JSON.stringify(patch).length}`, () => assert.throws(() => parseRevisionRequest({ ...fixture().request, ...patch }), errorCode("invalid_input")));
  }
  test("source and relevant notes load through the same owner-scoped workflow", async () => {
    const f = fixture(); const loaded = await loadRevisionSource(f.store, owner, sourceId, hash);
    assert.equal(loaded.base_token, f.request.base_token); assert.equal(loaded.annotations.length, 1);
  });
  test("a source owned by someone else is not loaded", async () => {
    const f = fixture(); await assert.rejects(() => loadRevisionSource(f.store, "other", sourceId, hash), errorCode("not_found"));
  });
  test("saving creates a separate full draft after a read-back of the archived base", async () => {
    const f = fixture(); const before = structuredClone(f.docs.get(sourceId));
    const result = await saveSectionDraft(f.store, owner, f.request, hash);
    assert.equal(result.doc_id, draftId); assert.equal(result.replayed, false);
    assert.deepEqual(f.docs.get(sourceId), before);
    assert.equal(f.versions.get(draftId).content_md, original);
    assert.equal(f.docs.get(draftId).content_md, replaceSection(original, f.request.section_key, f.request.replacement));
    assert.equal(f.docs.get(draftId).status, "draft");
    assert.ok(f.docs.get(draftId).tags.includes("agent"));
    const archiveWrite = f.calls.findIndex(([name]) => name === "insertVersion");
    const draftWrite = f.calls.findIndex(([name]) => name === "insertDoc");
    assert.ok(archiveWrite < draftWrite);
    assert.ok(f.calls.slice(archiveWrite + 1, draftWrite).some(([name]) => name === "readVersion"));
  });
  for (const field of ["content_md", "updated_at", "title", "folder", "status", "linked_case_id"]) {
    test(`stale ${field} prevents both writes`, async () => {
      const f = fixture(); f.docs.get(sourceId)[field] = "changed";
      await assert.rejects(() => saveSectionDraft(f.store, owner, f.request, hash), errorCode("stale_source"));
      assert.equal(f.versions.size, 0); assert.equal(f.docs.size, 1);
    });
  }
  test("changed review notes prevent a stale save", async () => {
    const f = fixture(); f.setAnnotations([]);
    await assert.rejects(() => saveSectionDraft(f.store, owner, f.request, hash), errorCode("stale_source"));
    assert.equal(f.versions.size, 0);
  });
  test("an annotation-read failure is not treated as no annotations", async () => {
    const f = fixture(); f.store.readAnnotations = async () => { throw Error("database failed"); };
    await assert.rejects(() => saveSectionDraft(f.store, owner, f.request, hash)); assert.equal(f.versions.size, 0);
  });
  test("archive failure cannot be followed by a draft write", async () => {
    const f = fixture(); f.store.insertVersion = async () => { throw Error("private database details"); };
    await assert.rejects(() => saveSectionDraft(f.store, owner, f.request, hash), errorCode("save_failed"));
    assert.equal(f.docs.size, 1);
  });
  test("archive write reported successful but not readable cannot create a draft", async () => {
    const f = fixture(); f.store.insertVersion = async () => {};
    await assert.rejects(() => saveSectionDraft(f.store, owner, f.request, hash), errorCode("save_failed")); assert.equal(f.docs.size, 1);
  });
  test("lost archive response recovers from readback", async () => {
    const f = fixture(); const insert = f.store.insertVersion;
    f.store.insertVersion = async (row) => { await insert(row); throw Error("lost response"); };
    assert.equal((await saveSectionDraft(f.store, owner, f.request, hash)).doc_id, draftId);
  });
  test("draft insertion failure preserves original and base and supports retry", async () => {
    const f = fixture(); const insert = f.store.insertDoc;
    f.store.insertDoc = async () => { throw Error("failed"); };
    await assert.rejects(() => saveSectionDraft(f.store, owner, f.request, hash), errorCode("save_failed"));
    assert.equal(f.docs.get(sourceId).content_md, original); assert.equal(f.versions.size, 1);
    f.store.insertDoc = insert; await saveSectionDraft(f.store, owner, f.request, hash);
    assert.equal(f.versions.size, 1); assert.equal(f.docs.size, 2);
  });
  test("identical retry recovers a saved draft even after the source changes", async () => {
    const f = fixture(); await saveSectionDraft(f.store, owner, f.request, hash);
    f.docs.get(sourceId).content_md = "Later work, never overwrite";
    const result = await saveSectionDraft(f.store, owner, f.request, hash);
    assert.equal(result.replayed, true); assert.equal(f.docs.get(sourceId).content_md, "Later work, never overwrite");
    assert.equal(f.versions.size, 1); assert.equal(f.docs.size, 2);
  });
  test("lost insertion response does not duplicate the draft", async () => {
    const f = fixture(); const insert = f.store.insertDoc;
    f.store.insertDoc = async (row) => { await insert(row); throw Error("lost response"); };
    const result = await saveSectionDraft(f.store, owner, f.request, hash);
    assert.equal(result.replayed, true); assert.equal(f.docs.size, 2);
  });
  test("a save not confirmed by readback is not reported successful", async () => {
    const f = fixture(); f.store.insertDoc = async () => {};
    await assert.rejects(() => saveSectionDraft(f.store, owner, f.request, hash), errorCode("save_failed"));
  });
  test("reuse of a request ID for different text never overwrites prior work", async () => {
    const f = fixture(); await saveSectionDraft(f.store, owner, f.request, hash);
    const saved = structuredClone(f.docs.get(draftId));
    await assert.rejects(() => saveSectionDraft(f.store, owner, { ...f.request, replacement: "Different" }, hash), errorCode("request_conflict"));
    assert.deepEqual(f.docs.get(draftId), saved);
  });
  test("later editing of a draft blocks a stale retry", async () => {
    const f = fixture(); await saveSectionDraft(f.store, owner, f.request, hash);
    f.docs.get(draftId).content_md = "Human revision";
    await assert.rejects(() => saveSectionDraft(f.store, owner, f.request, hash), errorCode("request_conflict"));
    assert.equal(f.docs.get(draftId).content_md, "Human revision");
  });
  test("a conflicting archive request cannot be reused", async () => {
    const f = fixture(); f.versions.set(draftId, { id: draftId, doc_id: sourceId, user_id: owner, content_md: original, note: "different request" });
    await assert.rejects(() => saveSectionDraft(f.store, owner, f.request, hash), errorCode("request_conflict")); assert.equal(f.docs.size, 1);
  });
  test("recovery refuses a missing archived base", async () => {
    const f = fixture(); await saveSectionDraft(f.store, owner, f.request, hash); f.versions.clear();
    await assert.rejects(() => saveSectionDraft(f.store, owner, f.request, hash), errorCode("request_conflict"));
  });
  test("new draft drops stale revision receipt tags inherited from earlier drafts", async () => {
    const f = fixture(); const doc = f.docs.get(sourceId); doc.tags.push("sosphd-revision:request:stale");
    f.request.base_token = revisionToken(doc, await f.store.readAnnotations(sourceId), hash);
    await saveSectionDraft(f.store, owner, f.request, hash);
    assert.ok(!f.docs.get(draftId).tags.includes("sosphd-revision:request:stale"));
  });
  test("annotation order does not create a false stale revision", () => {
    const doc = fixture().docs.get(sourceId);
    const a = [{ id: "b", quote: "", comment: "2", resolved: false }, { id: "a", quote: "", comment: "1", resolved: false }];
    assert.equal(revisionToken(doc, a, hash), revisionToken(doc, [...a].reverse(), hash));
  });
}

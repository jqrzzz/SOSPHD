"use client";

/* ─── Doc workspace ────────────────────────────────────────────────────
 *  Read ⇄ Edit for a research document. Papers open in Read by default:
 *  a doctoral draft is read far more often than it is edited, and the
 *  annotation loop happens while reading. Everything else opens in Edit.
 *
 *  Selecting text in the reading view feeds the annotations panel — that
 *  panel listens for document-wide selection, so no wiring is needed
 *  between the two components.
 * ────────────────────────────────────────────────────────────────────── */

import { useMemo, useState } from "react";
import { DocEditor } from "@/components/doc-editor";
import { MarkdownView } from "@/components/markdown-view";
import { parseMarkdown, readingMinutes, tableOfContents, wordCount } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import type { Doc } from "@/lib/data/docs-types";
import type { Case } from "@/lib/data/types";

export function DocWorkspace({ doc, cases }: { doc: Doc; cases: Case[] }) {
  const [mode, setMode] = useState<"read" | "edit">(
    doc.folder === "Papers" ? "read" : "edit",
  );

  const { blocks, toc, words, minutes } = useMemo(() => {
    const parsed = parseMarkdown(doc.content_md);
    // Papers open with their own "# Title" line, and the reader already
    // shows the doc title above the body — drop the leading h1 so the
    // title doesn't appear twice. Edit mode still shows the raw source.
    const body =
      parsed[0]?.type === "heading" && parsed[0].level === 1
        ? parsed.slice(1)
        : parsed;
    return {
      blocks: body,
      toc: tableOfContents(parsed),
      words: wordCount(doc.content_md),
      minutes: readingMinutes(doc.content_md),
    };
  }, [doc.content_md]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Mode switch + reading meta */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <div className="flex rounded-md border border-border p-0.5">
          {(["read", "edit"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium capitalize transition-colors",
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={mode === m}
            >
              {m}
            </button>
          ))}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {doc.folder}
        </span>
        {mode === "read" && (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {words.toLocaleString()} words · ~{minutes} min read
          </span>
        )}
      </div>

      {mode === "edit" ? (
        <DocEditor doc={doc} cases={cases} />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Table of contents rail */}
          {toc.length > 0 && (
            <nav
              className="hidden w-56 shrink-0 overflow-y-auto border-r border-border p-4 xl:block"
              aria-label="Table of contents"
            >
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Contents
              </p>
              <ul className="flex flex-col gap-1">
                {toc.map((h) => (
                  <li key={h.id}>
                    <a
                      href={`#${h.id}`}
                      className={cn(
                        "block truncate text-xs text-muted-foreground hover:text-foreground",
                        h.level === 3 && "pl-3",
                      )}
                      title={h.text}
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-8">
            {/* Compact TOC below xl */}
            {toc.length > 0 && (
              <details className="mb-6 xl:hidden">
                <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Contents
                </summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {toc.map((h) => (
                    <li key={h.id}>
                      <a
                        href={`#${h.id}`}
                        className={cn(
                          "text-xs text-muted-foreground hover:text-foreground",
                          h.level === 3 && "pl-3",
                        )}
                      >
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <h1 className="mb-6 max-w-3xl text-2xl font-semibold tracking-tight text-foreground">
              {doc.title}
            </h1>

            {doc.content_md.trim() ? (
              <MarkdownView blocks={blocks} />
            ) : (
              <p className="text-sm text-muted-foreground">
                This document is empty. Switch to Edit to start writing.
              </p>
            )}

            <p className="mt-10 max-w-3xl border-t border-border pt-4 text-[11px] text-muted-foreground">
              Select any passage to annotate it — open notes are read by the
              research agent and addressed in the next version.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

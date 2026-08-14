/* ─── Markdown reading view ────────────────────────────────────────────
 *  Renders the token tree from lib/markdown as React elements — never
 *  raw HTML, so there is no injection surface. Typography is tuned for
 *  reading a paper end to end: generous measure, clear heading
 *  hierarchy, tables that scroll rather than overflow the page.
 * ────────────────────────────────────────────────────────────────────── */

import type { Block, InlineNode } from "@/lib/markdown";

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case "text":
            return <span key={i}>{n.value}</span>;
          case "strong":
            return (
              <strong key={i} className="font-semibold text-foreground">
                <Inline nodes={n.children} />
              </strong>
            );
          case "em":
            return (
              <em key={i} className="italic">
                <Inline nodes={n.children} />
              </em>
            );
          case "code":
            return (
              <code
                key={i}
                className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.85em] text-foreground"
              >
                {n.value}
              </code>
            );
          case "link":
            return (
              <a
                key={i}
                href={n.href}
                target={n.href.startsWith("http") ? "_blank" : undefined}
                rel={n.href.startsWith("http") ? "noreferrer noopener" : undefined}
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                <Inline nodes={n.children} />
              </a>
            );
        }
      })}
    </>
  );
}

const HEADING_CLASS: Record<number, string> = {
  1: "mt-2 text-3xl font-semibold tracking-tight text-foreground",
  2: "mt-10 border-b border-border pb-2 text-xl font-semibold tracking-tight text-foreground",
  3: "mt-8 text-base font-semibold text-foreground",
  4: "mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground",
  5: "mt-4 text-sm font-semibold text-muted-foreground",
  6: "mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
};

export function MarkdownView({ blocks }: { blocks: Block[] }) {
  return (
    <article className="flex max-w-3xl flex-col gap-4 text-[15px] leading-7 text-foreground/85">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading": {
            const Tag = `h${Math.min(b.level, 6)}` as "h1";
            return (
              <Tag
                key={i}
                id={b.id}
                className={`scroll-mt-24 ${HEADING_CLASS[b.level] ?? HEADING_CLASS[6]}`}
              >
                <Inline nodes={b.children} />
              </Tag>
            );
          }
          case "paragraph":
            return (
              <p key={i}>
                <Inline nodes={b.children} />
              </p>
            );
          case "list":
            return b.ordered ? (
              <ol key={i} className="ml-5 flex list-decimal flex-col gap-1.5 marker:text-muted-foreground">
                {b.items.map((item, j) => (
                  <li key={j} className="pl-1">
                    <Inline nodes={item} />
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={i} className="ml-5 flex list-disc flex-col gap-1.5 marker:text-muted-foreground">
                {b.items.map((item, j) => (
                  <li key={j} className="pl-1">
                    <Inline nodes={item} />
                  </li>
                ))}
              </ul>
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="border-l-2 border-primary/50 pl-4 text-muted-foreground"
              >
                <Inline nodes={b.children} />
              </blockquote>
            );
          case "table":
            return (
              <div key={i} className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {b.header.map((cell, j) => (
                        <th
                          key={j}
                          className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          <Inline nodes={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, j) => (
                      <tr key={j} className="border-b border-border/60">
                        {row.map((cell, k) => (
                          <td key={k} className="px-3 py-2 align-top tabular-nums">
                            <Inline nodes={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "code":
            return (
              <pre
                key={i}
                className="overflow-x-auto rounded-lg border border-border bg-secondary/40 p-3 font-mono text-xs leading-relaxed"
              >
                {b.value}
              </pre>
            );
          case "hr":
            return <hr key={i} className="my-4 border-border" />;
        }
      })}
    </article>
  );
}

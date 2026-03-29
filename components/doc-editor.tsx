"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { updateDocAction } from "@/lib/docs-actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOC_FOLDERS } from "@/lib/data/docs-types";
import type { Doc } from "@/lib/data/docs-types";
import { getCases } from "@/lib/data/store";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

const DEBOUNCE_MS = 1500;

export function DocEditor({ doc }: { doc: Doc }) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content_md);
  const [folder, setFolder] = useState(doc.folder);
  const [status, setStatus] = useState(doc.status);
  const [linkedCaseId, setLinkedCaseId] = useState(doc.linked_case_id ?? "");
  const [isSaving, startSaving] = useTransition();
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cases = getCases();

  // Sync if doc prop changes (e.g., after version restore)
  useEffect(() => {
    setTitle(doc.title);
    setContent(doc.content_md);
    setFolder(doc.folder);
    setStatus(doc.status);
    setLinkedCaseId(doc.linked_case_id ?? "");
  }, [doc.title, doc.content_md, doc.folder, doc.status, doc.linked_case_id]);

  const saveDoc = useCallback(
    (updates: {
      title?: string;
      content_md?: string;
      folder?: string;
      status?: "draft" | "active" | "archived";
      linked_case_id?: string;
    }) => {
      startSaving(async () => {
        const result = await updateDocAction({ id: doc.id, ...updates });
        if (result.success) {
          setLastSaved(new Date());
        } else if (result.error) {
          toast.error(result.error);
        }
      });
    },
    [doc.id],
  );

  const debouncedSave = useCallback(
    (updates: { title?: string; content_md?: string }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => saveDoc(updates), DEBOUNCE_MS);
    },
    [saveDoc],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    debouncedSave({ title: value });
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    debouncedSave({ content_md: value });
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(content);
    toast.success("Markdown copied to clipboard");
  };

  const handleDownloadMd = () => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.slug ?? "document"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Allow external content replacement (from AI tools)
  const applyContent = useCallback(
    (newContent: string) => {
      setContent(newContent);
      saveDoc({ content_md: newContent });
    },
    [saveDoc],
  );

  // Expose applyContent on the window for the AI tools panel
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__docEditorApplyContent =
      applyContent;
    return () => {
      delete (window as unknown as Record<string, unknown>)
        .__docEditorApplyContent;
    };
  }, [applyContent]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <Select
          value={folder}
          onValueChange={(v) => {
            setFolder(v);
            saveDoc({ folder: v });
          }}
        >
          <SelectTrigger className="h-7 w-28 text-xs" aria-label="Folder">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOC_FOLDERS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(v) => {
            const s = v as "draft" | "active" | "archived";
            setStatus(s);
            saveDoc({ status: s });
          }}
        >
          <SelectTrigger className="h-7 w-24 text-xs" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={linkedCaseId || "none"}
          onValueChange={(v) => {
            const val = v === "none" ? "" : v;
            setLinkedCaseId(val);
            saveDoc({ linked_case_id: val });
          }}
        >
          <SelectTrigger className="h-7 w-40 text-xs" aria-label="Linked case">
            <SelectValue placeholder="Link to case..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No linked case</SelectItem>
            {cases.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.patient_ref}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          {isSaving && (
            <span className="text-[10px] text-muted-foreground">Saving...</span>
          )}
          {lastSaved && !isSaving && (
            <span className="text-[10px] text-muted-foreground">
              Saved {formatDate(lastSaved, "time")}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleCopyMarkdown}
          >
            Copy MD
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleDownloadMd}
          >
            Download .md
          </Button>
        </div>
      </div>

      {/* Title */}
      <div className="border-b border-border px-6 py-3">
        <Input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="border-none bg-transparent px-0 text-xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
          aria-label="Document title"
        />
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto p-6">
        <Textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          className="min-h-[600px] w-full resize-none border-none bg-transparent font-mono text-sm leading-relaxed shadow-none focus-visible:ring-0"
          placeholder="Start writing in Markdown..."
          aria-label="Document content"
        />
      </div>
    </div>
  );
}

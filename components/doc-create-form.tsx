"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createDocAction } from "@/lib/docs-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOC_FOLDERS } from "@/lib/data/docs-types";

const TEMPLATES = [
  {
    label: "Blank Document",
    content: "",
  },
  {
    label: "Paper Skeleton",
    content: `# [Paper Title]

## Abstract

[Brief summary of the paper]

## 1. Introduction

### 1.1 Background

### 1.2 Research Questions

## 2. Related Work

## 3. Methods

### 3.1 Study Design

### 3.2 Data Collection

### 3.3 Analysis

## 4. Results

## 5. Discussion

### 5.1 Limitations

### 5.2 Future Work

## 6. Conclusion

## References
`,
  },
  {
    label: "Weekly Field Log",
    content: `# Field Log: [Date Range]

## Cases Observed

### Case [ID] ([Patient Ref]) -- [Brief Description]
- Key observations:
- Metrics recorded:
- **Key insight:**

## System Observations

- Recommendation engine performance:
- Operator behavior notes:
- Override analysis:

## Next Week Focus

- 
`,
  },
  {
    label: "Research One-Pager",
    content: `# [Research Title]

## Problem

[What problem are you solving?]

## Approach

[How are you solving it?]

## Key Contributions

1. 
2. 
3. 

## Current Status

[Where are you now?]

## Next Steps

- 
`,
  },
];

export function DocCreateForm() {
  const [state, formAction, isPending] = useActionState(createDocAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          placeholder="e.g., Paper 1 Methods Draft"
          required
        />
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="folder">Folder</Label>
          <Select name="folder" defaultValue="General">
            <SelectTrigger id="folder">
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
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input
            id="tags"
            name="tags"
            placeholder="e.g., paper-1, methods"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Start from template</Label>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <TemplateButton key={t.label} label={t.label} content={t.content} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="content_md">Initial Content (Markdown)</Label>
        <Textarea
          id="content_md"
          name="content_md"
          placeholder="Start writing or select a template above..."
          rows={8}
          className="font-mono text-sm"
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href="/docs">Cancel</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create Document"}
        </Button>
      </div>
    </form>
  );
}

function TemplateButton({ label, content }: { label: string; content: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="text-xs"
      onClick={() => {
        const textarea = document.getElementById(
          "content_md",
        ) as HTMLTextAreaElement | null;
        if (textarea) {
          // Use native setter to ensure React picks up the value
          const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            "value",
          )?.set;
          nativeSetter?.call(textarea, content);
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }}
    >
      {label}
    </Button>
  );
}

"use client";

import { useState, useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createUploadAction, deleteUploadAction } from "@/lib/workspace-actions";
import type { Upload, UploadCategory } from "@/lib/data/workspace-types";
import { cn, formatDate } from "@/lib/utils";

const CATEGORY_ICONS: Record<UploadCategory, string> = {
  transcript: "TXT",
  pdf: "PDF",
  image: "IMG",
  video: "VID",
  document: "DOC",
  other: "FILE",
};

const CATEGORY_COLORS: Record<UploadCategory, string> = {
  transcript: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pdf: "bg-red-500/15 text-red-400 border-red-500/30",
  image: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  video: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  document: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  other: "bg-muted text-muted-foreground border-border",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function detectCategory(mimeType: string): UploadCategory {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("text/")) return "transcript";
  return "document";
}

export function WorkspaceUploads({
  initialUploads,
}: {
  initialUploads: Upload[];
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (prev: { error?: string; success?: boolean } | null, formData: FormData) => {
      const result = await createUploadAction(prev, formData);
      if (result?.success) {
        setOpen(false);
        setSelectedFile(null);
        router.refresh();
      }
      return result;
    },
    null,
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = initialUploads.filter((u) => {
    if (categoryFilter !== "all" && u.category !== categoryFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.filename.toLowerCase().includes(q) ||
      u.notes.toLowerCase().includes(q) ||
      u.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search uploads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
          aria-label="Search uploads"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-36" aria-label="Filter by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="transcript">Transcripts</SelectItem>
            <SelectItem value="pdf">PDFs</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Upload File</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload File</DialogTitle>
            </DialogHeader>
            <form action={formAction} className="flex flex-col gap-4">
              {/* File picker */}
              <div className="flex flex-col gap-2">
                <Label>File</Label>
                <div
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors",
                    "border-border hover:border-primary/50",
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label="Click to select a file"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  {selectedFile ? (
                    <p className="text-sm text-foreground">{selectedFile.name}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Click to select a file
                    </p>
                  )}
                </div>
              </div>

              {/* Hidden fields populated from file */}
              <input
                type="hidden"
                name="filename"
                value={selectedFile?.name ?? ""}
              />
              <input
                type="hidden"
                name="mime_type"
                value={selectedFile?.type ?? "application/octet-stream"}
              />
              <input
                type="hidden"
                name="size_bytes"
                value={selectedFile?.size ?? 0}
              />
              <input
                type="hidden"
                name="category"
                value={selectedFile ? detectCategory(selectedFile.type) : "other"}
              />
              <input type="hidden" name="url" value="#" />

              <div className="flex flex-col gap-2">
                <Label htmlFor="upload-tags">Tags (comma-separated)</Label>
                <Input id="upload-tags" name="tags" placeholder="research, case-004" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="upload-notes">Notes</Label>
                <Textarea
                  id="upload-notes"
                  name="notes"
                  rows={3}
                  placeholder="What is this file about?"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor="upload-case">Case</Label>
                  <Input id="upload-case" name="linked_case_id" placeholder="case_001" />
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor="upload-doc">Doc</Label>
                  <Input id="upload-doc" name="linked_doc_id" placeholder="doc_001" />
                </div>
              </div>
              {state?.error && (
                <p className="text-sm text-destructive" role="alert">{state.error}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Saves file metadata for reference tracking. File content is not uploaded.
              </p>
              <Button type="submit" disabled={pending || !selectedFile}>
                {pending ? "Saving..." : "Save Reference"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {search || categoryFilter !== "all"
              ? "No uploads match your filters."
              : "No uploads yet. Add one above."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Type</TableHead>
                <TableHead>Filename</TableHead>
                <TableHead className="hidden md:table-cell">Notes</TableHead>
                <TableHead className="w-20">Size</TableHead>
                <TableHead className="hidden lg:table-cell">Tags</TableHead>
                <TableHead className="w-20">Date</TableHead>
                <TableHead className="w-16">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((upload) => (
                <TableRow key={upload.id}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-mono",
                        CATEGORY_COLORS[upload.category],
                      )}
                    >
                      {CATEGORY_ICONS[upload.category]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {upload.filename}
                  </TableCell>
                  <TableCell className="hidden max-w-[200px] truncate text-muted-foreground md:table-cell">
                    {upload.notes || "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatBytes(upload.size_bytes)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {upload.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatDate(upload.created_at, "short")}
                  </TableCell>
                  <TableCell>
                    <form action={() => deleteUploadAction(upload.id)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                      >
                        Delete
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

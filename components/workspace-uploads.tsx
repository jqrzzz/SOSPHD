"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
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
import { getSupabase, getCurrentUserId } from "@/lib/supabase/db";
import type { Upload, UploadCategory } from "@/lib/data/workspace-types";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "sonner";

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
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
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

  /**
   * Upload the file to the private `research-uploads` bucket FIRST
   * (path: {auth.uid()}/{uuid}-{filename}, enforced by storage RLS),
   * then persist metadata with the storage path as `url`. If the
   * storage upload fails, no metadata row is written — no more
   * url="#" phantom references.
   */
  async function handleUploadSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!selectedFile || pending) return;
    setPending(true);
    setError(null);
    try {
      const sb = getSupabase();
      const userId = await getCurrentUserId();
      if (!sb || !userId) {
        setError("Sign in required to upload files.");
        return;
      }
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await sb.storage
        .from("research-uploads")
        .upload(path, selectedFile, { contentType: selectedFile.type || undefined });
      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`);
        return;
      }
      const fd = new FormData(form);
      fd.set("url", path);
      const result = await createUploadAction(null, fd);
      if (result?.error) {
        // Metadata failed after the file landed — remove the orphan object.
        await sb.storage.from("research-uploads").remove([path]);
        setError(result.error);
        return;
      }
      toast.success("File uploaded");
      setSelectedFile(null);
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  /** Private bucket — serve via a short-lived signed URL. */
  async function downloadUpload(upload: Upload) {
    const sb = getSupabase();
    if (!sb) {
      toast.error("Supabase is not configured.");
      return;
    }
    if (!upload.url || upload.url === "#") {
      toast.error("This is a legacy metadata-only reference — no file was stored.");
      return;
    }
    const { data, error: signError } = await sb.storage
      .from("research-uploads")
      .createSignedUrl(upload.url, 300);
    if (signError || !data?.signedUrl) {
      toast.error(`Could not create download link: ${signError?.message ?? "unknown error"}`);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
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
            <form onSubmit={handleUploadSubmit} className="flex flex-col gap-4">
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
              {/* url is set by handleUploadSubmit to the storage path
                  after a successful upload. */}
              <input type="hidden" name="url" value="pending-upload" />

              {/* Research consent for the file's content (recordings!) */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="upload-consent">Research consent</Label>
                <Select name="consent_status" defaultValue="not_required">
                  <SelectTrigger id="upload-consent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_required">Not required (self-authored)</SelectItem>
                    <SelectItem value="pending">Pending — consent not yet captured</SelectItem>
                    <SelectItem value="obtained">Obtained</SelectItem>
                    <SelectItem value="declined">Declined — exclude from research</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-4">
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor="upload-consent-method">Consent method</Label>
                  <Input id="upload-consent-method" name="consent_method" placeholder="verbal / written / recorded" />
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor="upload-consent-jurisdiction">Jurisdiction</Label>
                  <Input id="upload-consent-jurisdiction" name="consent_jurisdiction" placeholder="ISO code, e.g. TH" maxLength={8} />
                </div>
              </div>

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
              {error && (
                <p className="text-sm text-destructive" role="alert">{error}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Uploads to the private research-uploads bucket, then saves the
                metadata reference. Files are served via short-lived signed
                links.
              </p>
              <Button type="submit" disabled={pending || !selectedFile}>
                {pending ? "Uploading..." : "Upload & Save"}
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
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => downloadUpload(upload)}
                      >
                        Download
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (window.confirm(`Delete "${upload.filename}"?`)) {
                            deleteUploadAction(upload.id);
                            toast.success("File reference deleted");
                            router.refresh();
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
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

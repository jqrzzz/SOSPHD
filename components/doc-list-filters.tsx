"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOC_FOLDERS } from "@/lib/data/docs-types";

export function DocListFilters({
  currentFolder,
  currentSearch,
  currentTag,
  availableTags,
}: {
  currentFolder?: string;
  currentSearch?: string;
  currentTag?: string;
  availableTags: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(currentSearch ?? "");

  const updateFilter = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      startTransition(() => {
        router.push(`/docs?${params.toString()}`);
      });
    },
    [router, searchParams],
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilter("q", search || undefined);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
      <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
        <Input
          type="search"
          placeholder="Search docs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-52 text-sm"
          aria-label="Search documents"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
          Search
        </Button>
      </form>

      <Select
        value={currentFolder ?? "all"}
        onValueChange={(v) => updateFilter("folder", v === "all" ? undefined : v)}
      >
        <SelectTrigger className="h-8 w-36 text-xs" aria-label="Filter by folder">
          <SelectValue placeholder="All Folders" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Folders</SelectItem>
          {DOC_FOLDERS.map((f) => (
            <SelectItem key={f} value={f}>
              {f}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {availableTags.length > 0 && (
        <Select
          value={currentTag ?? "all"}
          onValueChange={(v) => updateFilter("tag", v === "all" ? undefined : v)}
        >
          <SelectTrigger className="h-8 w-36 text-xs" aria-label="Filter by tag">
            <SelectValue placeholder="All Tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {availableTags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {(currentFolder || currentSearch || currentTag) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => {
            setSearch("");
            startTransition(() => router.push("/docs"));
          }}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}

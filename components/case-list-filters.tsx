"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const STATUS_TABS = [
  { value: undefined, label: "All" },
  { value: "open", label: "Open" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
] as const;

export function CaseListFilters({
  currentStatus,
  currentSearch,
}: {
  currentStatus?: string;
  currentSearch?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(updates)) {
        if (val) {
          params.set(key, val);
        } else {
          params.delete(key);
        }
      }
      router.push(`/cases?${params.toString()}`);
    },
    [router, searchParams],
  );

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  return (
    <div className="flex items-center gap-4 border-b border-border px-6 py-3">
      {/* Status tabs */}
      <div className="flex gap-1" role="tablist" aria-label="Filter by status">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.label}
            role="tab"
            aria-selected={currentStatus === tab.value}
            onClick={() => updateParams({ status: tab.value })}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              currentStatus === tab.value
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="ml-auto w-64">
        <Input
          type="search"
          placeholder="Search patient ref or complaint..."
          value={search}
          onChange={(e) => {
            const val = e.target.value;
            setSearch(val);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              updateParams({ q: val || undefined });
            }, 400);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              updateParams({ q: search || undefined });
            }
          }}
          className="h-8 text-xs"
          aria-label="Search cases"
        />
      </div>
    </div>
  );
}

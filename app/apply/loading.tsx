import { Skeleton } from "@/components/ui/skeleton";

// Shape mirrors /apply: header, three stat cards, portfolio panel, rows.
// Exists because the page renders per-request (ARCHITECTURE §8.18) — a
// blank wait reads as broken; a skeleton reads as loading.
export default function ApplyLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-1 px-2 pt-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-lg" />
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-32 rounded-lg" />
      ))}
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function PapersLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-1 px-2 pt-2">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-64 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

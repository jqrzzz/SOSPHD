import { Skeleton } from "@/components/ui/skeleton";

export default function AdvisorLoading() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Skeleton className="h-4 w-32" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="flex flex-1">
        <div className="w-48 border-r border-border p-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="mb-2 h-12 rounded-md" />
          ))}
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Skeleton className="h-32 w-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

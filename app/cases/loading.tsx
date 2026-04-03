import { Skeleton } from "@/components/ui/skeleton";

export default function CasesLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-8 w-24" />
      </header>
      <div className="flex items-center gap-4 border-b border-border px-6 py-3">
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-md" />
          ))}
        </div>
        <div className="ml-auto">
          <Skeleton className="h-8 w-64" />
        </div>
      </div>
      <div className="flex flex-col gap-2 p-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function FundingLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-1 px-2 pt-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-40 rounded-lg" />
      ))}
    </div>
  );
}

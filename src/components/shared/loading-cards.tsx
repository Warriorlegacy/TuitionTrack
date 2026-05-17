import { Skeleton } from "@/components/ui/skeleton";

export function LoadingCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rounded-3xl border border-white/80 bg-white/85 p-6 shadow-soft"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-8 w-20" />
          <Skeleton className="mt-5 h-3 w-36" />
        </div>
      ))}
    </div>
  );
}

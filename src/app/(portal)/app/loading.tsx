import { Skeleton } from "@/components/ui/skeleton";

export default function PortalLoading() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 animate-shimmer" />
        <Skeleton className="h-4 w-80 animate-shimmer" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-soft"
          >
            <Skeleton className="mb-3 h-3 w-24 animate-shimmer" />
            <Skeleton className="h-8 w-16 animate-shimmer" />
            <Skeleton className="mt-2 h-3 w-36 animate-shimmer" />
          </div>
        ))}
      </div>

      {/* Table / content skeleton */}
      <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-soft">
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-5 w-32 animate-shimmer" />
          <Skeleton className="h-8 w-24 animate-shimmer rounded-xl" />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-full animate-shimmer" style={{ animationDelay: `${i * 100}ms` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

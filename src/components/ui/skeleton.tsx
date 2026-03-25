import { cn } from "@/lib/utils"

type SkeletonProps = React.ComponentProps<"div"> & {
  variant?: "pulse" | "shimmer"
}

function Skeleton({ className, variant = "pulse", ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md",
        variant === "pulse" ? "bg-accent animate-pulse" : "skeleton-shimmer",
        className
      )}
      {...props}
    />
  )
}

/** A single KpiCard-shaped skeleton */
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-0 bg-muted/40 p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="h-7 w-16 mb-1.5" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}

/** N rows of table-row skeletons */
function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-2 py-1.5">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" style={{ animationDelay: `${i * 40 + j * 10}ms` }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export { Skeleton, SkeletonCard, SkeletonTable }

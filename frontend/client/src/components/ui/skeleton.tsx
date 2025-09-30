import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

// Specialized skeleton components for consistent loading states
function SkeletonStatsCard() {
  return (
    <div className="p-6 bg-card border rounded-lg shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}

function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-card border rounded-lg">
      {/* Table Header */}
      <div className="p-4 border-b bg-muted/50">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      
      {/* Table Rows */}
      <div className="divide-y">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="p-6 bg-card border rounded-lg shadow-sm space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-6 w-16" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-24" />
      </div>
    </div>
  )
}

function SkeletonHeader() {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  )
}

function SkeletonSearchFilter() {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="flex-1 max-w-sm">
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-10 w-28" />
      <Skeleton className="h-10 w-24" />
    </div>
  )
}

function SkeletonGrid({ items = 6, columns = 3 }: { items?: number; columns?: number }) {
  const gridClass = columns === 2 ? "md:grid-cols-2" : columns === 4 ? "md:grid-cols-4" : "md:grid-cols-3";
  
  return (
    <div className={`grid grid-cols-1 ${gridClass} gap-6`}>
      {[...Array(items)].map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export { 
  Skeleton, 
  SkeletonStatsCard, 
  SkeletonTable, 
  SkeletonCard, 
  SkeletonHeader, 
  SkeletonSearchFilter, 
  SkeletonGrid 
}

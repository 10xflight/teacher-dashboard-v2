/** Reusable skeleton building blocks for loading states. */

interface SkeletonProps {
  className?: string;
}

/** A single shimmer bar — use w-* and h-* to size it. */
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton ${className}`} />;
}

/** A text-like line. Default: full width, 14px tall. */
export function SkeletonLine({ className = 'w-full' }: SkeletonProps) {
  return <Skeleton className={`h-3.5 ${className}`} />;
}

/** A rounded card container with shimmer children. */
export function SkeletonCard({ className = '', children }: SkeletonProps & { children?: React.ReactNode }) {
  return (
    <div className={`rounded-xl bg-bg-card border border-border p-5 ${className}`}>
      {children || (
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      )}
    </div>
  );
}

// ============================================================
// Page-specific skeleton compositions
// ============================================================

/** Dashboard: countdown stat cards */
export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[0, 1, 2].map(i => (
        <div key={i} className="rounded-xl bg-bg-card border border-border p-4 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Dashboard: 5-day calendar strip */
export function WeekStripSkeleton() {
  return (
    <div className="grid grid-cols-5 gap-3">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="rounded-xl bg-bg-card border border-border p-4 space-y-3 min-h-[180px]">
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-5 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** Dashboard: today's lessons sidebar */
export function LessonsSkeleton() {
  return (
    <div className="rounded-xl bg-bg-card border border-border p-5 space-y-4">
      <Skeleton className="h-5 w-32" />
      {[0, 1, 2].map(i => (
        <div key={i} className="flex gap-3 items-start">
          <Skeleton className="h-10 w-1 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Task table skeleton */
export function TaskTableSkeleton() {
  return (
    <div className="rounded-xl bg-bg-card border border-border p-5 space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="flex gap-3 items-center py-2">
          <Skeleton className="h-4 w-4 rounded shrink-0" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3 w-16 hidden md:block" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Calendar: month grid skeleton */
export function CalendarGridSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <Skeleton key={`h${i}`} className="h-6 w-full" />
        ))}
        {/* 5 weeks x 7 days */}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-bg-card border border-border p-2 min-h-[80px] space-y-1">
            <Skeleton className="h-4 w-6" />
            {i % 3 === 0 && <Skeleton className="h-3 w-full" />}
            {i % 5 === 0 && <Skeleton className="h-3 w-3/4" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Standards: class tiles + table rows */
export function StandardsSkeleton() {
  return (
    <div className="space-y-5">
      {/* Class selector tiles */}
      <div className="flex gap-2 flex-wrap">
        {[0, 1, 2, 3].map(i => (
          <Skeleton key={i} className="h-16 w-36 rounded-lg" />
        ))}
      </div>
      {/* Coverage bar */}
      <div className="rounded-xl bg-bg-card border border-border p-4 space-y-2">
        <div className="flex gap-6">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-4 w-20" />
          ))}
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      {/* Table rows */}
      <div className="rounded-xl bg-bg-card border border-border overflow-hidden">
        <div className="flex gap-4 p-3 border-b border-border">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={i} className="flex gap-4 p-3 border-b border-border/50">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tasks: filter pills + table rows */
export function TasksPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-7 w-28" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-9 w-full rounded-lg" />
      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {[0, 1, 2, 3].map(i => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      {/* Task rows */}
      <div className="rounded-xl bg-bg-card border border-border p-4 space-y-2">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex gap-3 items-center py-2.5 border-b border-border/30 last:border-0">
            <Skeleton className="h-4 w-4 rounded shrink-0" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-3 w-20 hidden md:block" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16 hidden md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Materials: filter bar + grouped cards */
export function MaterialsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex gap-3 flex-wrap">
        <Skeleton className="h-9 flex-1 min-w-[200px] rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      {/* Grouped weeks */}
      {[0, 1].map(g => (
        <div key={g} className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <div className="space-y-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-bg-card border border-border p-3">
                <Skeleton className="h-6 w-16 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-6 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Bellringer Library: search + card list */
export function LibrarySkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="rounded-xl bg-bg-card border border-border p-4 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/** Settings: form sections */
export function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="rounded-xl bg-bg-card border border-border p-5 space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map(j => (
              <div key={j} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

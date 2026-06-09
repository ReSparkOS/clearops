import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  // Rendered as an inline-block span so it is valid inside headings and paragraphs too.
  return <span className={cn("block animate-pulse rounded-md bg-line/80", className)} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cn("h-3.5", index === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface p-5 shadow-card", className)}>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-8 w-20" />
    </div>
  );
}

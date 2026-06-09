import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <AppShell title={<Skeleton className="h-7 w-40" />}>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>

        <Card className="p-5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="mt-4 h-64 w-full rounded-lg" />
        </Card>

        <Card className="p-5">
          <Skeleton className="h-4 w-28" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

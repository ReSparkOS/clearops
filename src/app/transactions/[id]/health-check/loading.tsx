import { AppShell } from "@/components/app-shell";
import { HealthReportSkeleton } from "@/components/health/health-report-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function HealthCheckLoading() {
  return (
    <AppShell title={<Skeleton className="h-7 w-56" />}>
      <HealthReportSkeleton />
    </AppShell>
  );
}

import { AppShell } from "@/components/app-shell";
import { HealthReportSkeleton } from "@/components/health/health-report-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function TransactionLoading() {
  return (
    <AppShell title={<Skeleton className="h-7 w-72" />}>
      <HealthReportSkeleton />
    </AppShell>
  );
}

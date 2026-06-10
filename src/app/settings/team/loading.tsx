import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeamLoading() {
  return (
    <AppShell title={<Skeleton className="h-7 w-32" />} eyebrow="Settings">
      <div className="space-y-6">
        <Card className="p-5">
          <Skeleton className="h-4 w-36" />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 sm:w-40" />
            <Skeleton className="h-10 sm:w-32" />
          </div>
        </Card>

        <Card className="p-0">
          <div className="border-b border-line px-5 py-4">
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-0">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 border-b border-line px-5 py-4 last:border-b-0">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

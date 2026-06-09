import Link from "next/link";
import { CalendarDays, Clock3, TriangleAlert } from "lucide-react";
import type { ContractCalendar, DeadlineCalendarEvent } from "@/lib/calendar/deadline-calendar";
import type { RiskStatus } from "@/lib/domain/types";
import { formatPercent } from "@/lib/domain/format";
import { RiskBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ContractCalendarPanel({ calendar }: { calendar: ContractCalendar }) {
  const agenda = calendar.upcoming.slice(0, 6);
  const urgentCount = calendar.riskCounts.expired + calendar.riskCounts.dueSoon + calendar.riskCounts.conflict;

  return (
    <section className="rounded-xl border border-line bg-surface shadow-card">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-ink-subtle" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">Contract calendar</h2>
          <span className="text-sm text-ink-muted">· {calendar.monthLabel}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Count tone="bad" label="Urgent" value={urgentCount} icon />
          <Count tone="good" label="On track" value={calendar.riskCounts.open} />
          <Count tone="neutral" label="Needs date" value={calendar.undated.length} />
        </div>
      </div>

      {calendar.totalEventCount === 0 ? (
        <div className="px-5 py-10 text-center text-sm font-medium text-ink-muted">No contract deadlines extracted yet.</div>
      ) : (
        <div className="grid gap-5 p-5 xl:grid-cols-[1.4fr_0.6fr]">
          <div className="overflow-x-auto rounded-lg border border-line thin-scroll">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-7 border-b border-line bg-surface-muted text-center text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                {calendar.weekdays.map((weekday) => (
                  <div key={weekday} className="py-2">
                    {weekday}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calendar.weeks.flat().map((day) => (
                  <div
                    key={day.dateKey}
                    className={cn(
                      "min-h-[88px] border-b border-r border-line/70 p-1.5 last:border-r-0",
                      !day.inCurrentMonth && "bg-surface-muted/60",
                      day.isToday && "bg-primary-soft/60",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "grid size-5 place-items-center rounded-full text-[11px] font-semibold",
                          day.isToday ? "bg-primary text-primary-fg" : day.inCurrentMonth ? "text-ink" : "text-ink-subtle",
                        )}
                      >
                        {day.dayOfMonth}
                      </span>
                    </div>
                    <div className="mt-1 space-y-1">
                      {day.events.slice(0, 2).map((event) => (
                        <Link
                          key={event.id}
                          href={`/transactions/${event.transactionId}`}
                          className={cn(
                            "block truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition hover:opacity-80",
                            riskChipClass(event.riskStatus),
                          )}
                          title={`${event.name} — ${event.propertyAddress}`}
                        >
                          {event.name}
                        </Link>
                      ))}
                      {day.events.length > 2 ? (
                        <p className="text-[10px] font-semibold text-ink-subtle">+{day.events.length - 2} more</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <AgendaList title="Next deadlines" events={agenda} empty="No dated deadlines." />
            {calendar.undated.length ? (
              <AgendaList title="Needs date review" events={calendar.undated.slice(0, 4)} empty="None." />
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function AgendaList({ title, events, empty }: { title: string; events: DeadlineCalendarEvent[]; empty: string }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
        <Clock3 size={14} aria-hidden="true" />
        {title}
      </div>
      <div className="mt-2 space-y-1.5">
        {events.length ? (
          events.map((event) => (
            <Link
              key={event.id}
              href={`/transactions/${event.transactionId}`}
              className="block rounded-md border border-line p-2 transition hover:bg-surface-muted"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium text-ink">{event.name}</p>
                <RiskBadge riskStatus={event.riskStatus} />
              </div>
              <p className="mt-0.5 truncate text-xs text-ink-muted">{event.propertyAddress}</p>
              <p className="mt-0.5 text-[11px] text-ink-subtle">
                {event.dayLabel} · {formatPercent(event.confidence)} confidence
              </p>
            </Link>
          ))
        ) : (
          <p className="rounded-md bg-surface-muted p-2 text-xs font-medium text-ink-muted">{empty}</p>
        )}
      </div>
    </div>
  );
}

function Count({ tone, label, value, icon }: { tone: "bad" | "good" | "neutral"; label: string; value: number; icon?: boolean }) {
  const toneClass = {
    bad: "border-rose-200 bg-rose-50 text-rose-700",
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    neutral: "border-line-strong bg-surface-muted text-ink-muted",
  }[tone];

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", toneClass)}>
      {icon ? <TriangleAlert size={13} aria-hidden="true" /> : null}
      {label}: {value}
    </span>
  );
}

function riskChipClass(riskStatus: RiskStatus) {
  return {
    open: "border-emerald-200 bg-emerald-50 text-emerald-700",
    due_soon: "border-amber-200 bg-amber-50 text-amber-800",
    expired: "border-rose-200 bg-rose-50 text-rose-700",
    ambiguous: "border-line-strong bg-surface-muted text-ink-muted",
    conflict: "border-rose-200 bg-rose-50 text-rose-700",
  }[riskStatus];
}

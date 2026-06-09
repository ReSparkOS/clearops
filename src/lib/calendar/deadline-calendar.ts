import type { RiskStatus, TransactionRecord } from "@/lib/domain/types";
import { formatDate } from "@/lib/domain/format";

export type DeadlineCalendarEvent = {
  id: string;
  transactionId: string;
  propertyAddress: string;
  name: string;
  date: string | null;
  dateKey: string | null;
  dateLabel: string;
  dayLabel: string;
  riskStatus: RiskStatus;
  sourcePage: number | null;
  confidence: number;
};

export type DeadlineCalendarDay = {
  date: string;
  dateKey: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  events: DeadlineCalendarEvent[];
};

export type ContractCalendar = {
  monthLabel: string;
  weekdays: string[];
  weeks: DeadlineCalendarDay[][];
  upcoming: DeadlineCalendarEvent[];
  undated: DeadlineCalendarEvent[];
  totalEventCount: number;
  riskCounts: {
    expired: number;
    dueSoon: number;
    open: number;
    ambiguous: number;
    conflict: number;
  };
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function buildContractCalendar(transactions: TransactionRecord[], asOf = new Date()): ContractCalendar {
  const events = transactions.flatMap((transaction) =>
    transaction.health.deadlines.map((deadline, index) => {
      const parsedDate = parseDate(deadline.date);
      return {
        id: `${transaction.id}-${index}-${slug(deadline.name)}`,
        transactionId: transaction.id,
        propertyAddress: transaction.propertyAddress,
        name: deadline.name,
        date: deadline.date,
        dateKey: parsedDate ? dateKey(parsedDate) : null,
        dateLabel: formatDate(deadline.date),
        dayLabel: parsedDate ? shortDateLabel(parsedDate) : "Needs review",
        riskStatus: deadline.riskStatus,
        sourcePage: deadline.sourcePage ?? null,
        confidence: deadline.confidence,
      };
    }),
  );

  const datedEvents = events
    .filter((event): event is DeadlineCalendarEvent & { dateKey: string } => Boolean(event.dateKey))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const undated = events.filter((event) => !event.dateKey);
  const focusDate = findFocusDate(datedEvents, asOf);
  const eventsByDate = groupEventsByDate(datedEvents);

  return {
    monthLabel: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(focusDate),
    weekdays,
    weeks: buildMonthGrid(focusDate, eventsByDate, dateKey(asOf)),
    upcoming: datedEvents,
    undated,
    totalEventCount: events.length,
    riskCounts: countRisk(events),
  };
}

function findFocusDate(events: DeadlineCalendarEvent[], asOf: Date) {
  const todayKey = dateKey(asOf);
  const upcoming = events.find((event) => event.dateKey && event.dateKey >= todayKey);
  const firstDated = upcoming ?? events[0];
  return parseDate(firstDated?.date ?? null) ?? asOf;
}

function buildMonthGrid(
  focusDate: Date,
  eventsByDate: Map<string, DeadlineCalendarEvent[]>,
  todayKey: string,
) {
  const firstOfMonth = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1, 12);
  const lastOfMonth = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0, 12);
  const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
  const gridEnd = addDays(lastOfMonth, 6 - lastOfMonth.getDay());
  const days: DeadlineCalendarDay[] = [];

  for (let current = gridStart; current <= gridEnd; current = addDays(current, 1)) {
    const key = dateKey(current);
    days.push({
      date: current.toISOString(),
      dateKey: key,
      dayOfMonth: current.getDate(),
      inCurrentMonth: current.getMonth() === focusDate.getMonth(),
      isToday: key === todayKey,
      events: eventsByDate.get(key) ?? [],
    });
  }

  const weeks: DeadlineCalendarDay[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }
  return weeks;
}

function groupEventsByDate(events: DeadlineCalendarEvent[]) {
  const grouped = new Map<string, DeadlineCalendarEvent[]>();
  for (const event of events) {
    if (!event.dateKey) {
      continue;
    }
    grouped.set(event.dateKey, [...(grouped.get(event.dateKey) ?? []), event]);
  }
  return grouped;
}

function countRisk(events: DeadlineCalendarEvent[]) {
  return events.reduce(
    (counts, event) => {
      if (event.riskStatus === "expired") {
        counts.expired += 1;
      } else if (event.riskStatus === "due_soon") {
        counts.dueSoon += 1;
      } else if (event.riskStatus === "ambiguous") {
        counts.ambiguous += 1;
      } else if (event.riskStatus === "conflict") {
        counts.conflict += 1;
      } else {
        counts.open += 1;
      }
      return counts;
    },
    { expired: 0, dueSoon: 0, open: 0, ambiguous: 0, conflict: 0 },
  );
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value.split("T")[0]}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function shortDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Date normalization. Extracted dates arrive in many shapes ("June 30, 2026", "06/30/2026",
// "2026-06-30T00:00:00Z", or relative text like "5 days after Effective Date"). We normalize to
// a plain YYYY-MM-DD for storage/classification, and return null when there is no resolvable date.

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export function toIsoDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  // Already starts with ISO YYYY-MM-DD (optionally with time).
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  // US numeric M/D/YYYY or M-D-YYYY.
  const us = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (us) {
    return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }

  // Month-name forms: "June 30, 2026" / "Jun 30 2026".
  const named = trimmed.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (named) {
    const month = MONTHS[named[1].slice(0, 3).toLowerCase()];
    if (month) {
      return `${named[3]}-${String(month).padStart(2, "0")}-${named[2].padStart(2, "0")}`;
    }
  }

  return null;
}

export function isoToday(asOf: Date = new Date()): string {
  return [
    asOf.getFullYear(),
    String(asOf.getMonth() + 1).padStart(2, "0"),
    String(asOf.getDate()).padStart(2, "0"),
  ].join("-");
}

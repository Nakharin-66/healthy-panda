/** Asia/Bangkok (UTC+7, no DST) date helpers. */
const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** YYYY-MM-DD of the given instant in Bangkok time. */
export function bkkDate(d: Date | string = new Date()): string {
  return fmt.format(typeof d === "string" ? new Date(d) : d);
}

/** HH:mm of the given instant in Bangkok time. */
export function bkkTime(d: Date | string): string {
  return timeFmt.format(typeof d === "string" ? new Date(d) : d);
}

export function bkkDayStart(date: string): string {
  return new Date(`${date}T00:00:00+07:00`).toISOString();
}

export function bkkDayEnd(date: string): string {
  return new Date(`${date}T23:59:59.999+07:00`).toISOString();
}

/** Bangkok calendar date shifted by `days`. */
export function bkkAddDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return bkkDate(d);
}

/** ISO instant for a Bangkok date + HH:mm. */
export function bkkInstant(date: string, hhmm: string): string {
  return new Date(`${date}T${hhmm}:00+07:00`).toISOString();
}

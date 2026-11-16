import { weekdays } from "./strings";

const TZ = "Asia/Jerusalem";

/** YYYY-MM-DD for a moment, in Israel time (matches private.today() in the database). */
export function isoDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Weekday letter (א׳…ש׳) for a YYYY-MM-DD date. */
export function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return weekdays[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "16.11" for a YYYY-MM-DD date. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}`;
}

/** "07:42" in Israel time. */
export function clock(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/** "ב׳ 16.11" for a timestamp, in Israel time. */
export function dayLabel(ts: string | Date): string {
  const iso = isoDate(typeof ts === "string" ? new Date(ts) : ts);
  return `${weekdayOf(iso)} ${shortDate(iso)}`;
}

/** Until-label for an assignment end date: weekday if within a week, else the date. */
export function untilLabel(endIso: string, todayIso: string): string {
  const days = (Date.parse(endIso) - Date.parse(todayIso)) / 86_400_000;
  if (days === 0) return "היום";
  if (days > 0 && days < 7) return weekdayOf(endIso);
  return shortDate(endIso);
}

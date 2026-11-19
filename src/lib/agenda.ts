// Pure helpers for calendar events (no server-only imports, so they're unit-testable).
import { clock, isoDate } from "./dates";

/** One event as Roma shows it. Deliberately no location or description (info-security). */
export type CalEvent = {
  id: string;
  title: string;
  day: string; // YYYY-MM-DD in Israel time
  start: string | null; // "08:00", null for all-day
  end: string | null;
  allDay: boolean;
  source: number; // which connected calendar (0..2)
};

type GoogleTime = { date?: string; dateTime?: string };
export type GoogleItem = { id?: string; summary?: string; status?: string; start?: GoogleTime; end?: GoogleTime };

/** Google API items → CalEvents. Multi-day all-day events appear on each day they cover. */
export function normalizeEvents(items: GoogleItem[], source: number): CalEvent[] {
  const out: CalEvent[] = [];
  for (const it of items) {
    if (it.status === "cancelled" || !it.start) continue;
    const title = (it.summary ?? "").trim() || "(ללא כותרת)";
    const id = it.id ?? `${source}-${title}-${JSON.stringify(it.start)}`;
    if (it.start.date) {
      // All-day: end.date is exclusive.
      const first = it.start.date;
      const last = it.end?.date ? addDays(it.end.date, -1) : first;
      for (let d = first; d <= last; d = addDays(d, 1)) {
        out.push({ id: `${id}:${d}`, title, day: d, start: null, end: null, allDay: true, source });
        if (out.length > 500) break;
      }
    } else if (it.start.dateTime) {
      const s = new Date(it.start.dateTime);
      const e = it.end?.dateTime ? new Date(it.end.dateTime) : null;
      out.push({ id, title, day: isoDate(s), start: clock(s), end: e ? clock(e) : null, allDay: false, source });
    }
  }
  return out;
}

function addDays(iso: string, days: number) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Events between [fromDay, fromDay + days), sorted, grouped by day. All-day first within a day. */
export function groupByDay(events: CalEvent[], fromDay: string, days: number) {
  const until = addDays(fromDay, days);
  const inRange = events
    .filter((e) => e.day >= fromDay && e.day < until)
    .sort((a, b) =>
      a.day !== b.day ? (a.day < b.day ? -1 : 1) : a.allDay !== b.allDay ? (a.allDay ? -1 : 1) : (a.start ?? "") < (b.start ?? "") ? -1 : 1,
    );
  const groups: { day: string; events: CalEvent[] }[] = [];
  for (const e of inRange) {
    const last = groups[groups.length - 1];
    if (last && last.day === e.day) last.events.push(e);
    else groups.push({ day: e.day, events: [e] });
  }
  return groups;
}

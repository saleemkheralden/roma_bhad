import { groupByDay, type CalEvent } from "@/lib/agenda";
import { shortDate, weekdayOf } from "@/lib/dates";
import { strings } from "@/lib/strings";

const c = strings.calendar;

function dayTitle(day: string, today: string, tomorrow: string) {
  if (day === today) return c.today;
  if (day === tomorrow) return c.tomorrow;
  return `${weekdayOf(day)} ${shortDate(day)}`;
}

/** Calendar events as ruled rows grouped by day, in Roma's own style (no iframe, no cookies). */
export function Agenda({
  events,
  today,
  days,
  limit = 12,
}: {
  events: CalEvent[];
  today: string;
  days: number;
  limit?: number;
}) {
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  // Keep the first `limit` events across days.
  const groups: ReturnType<typeof groupByDay> = [];
  let room = limit;
  for (const g of groupByDay(events, today, days)) {
    if (room <= 0) break;
    groups.push({ day: g.day, events: g.events.slice(0, room) });
    room -= g.events.length;
  }

  if (groups.length === 0) return <p className="text-base text-ink-2">{c.noEvents}</p>;

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <section key={g.day}>
          <h3 className={`mb-1 text-sm font-extrabold ${g.day === today ? "text-ink" : "text-ink-2"}`}>
            {dayTitle(g.day, today, tomorrow)}
          </h3>
          <ul className="divide-y divide-rule border-y border-rule">
            {g.events.map((e) => (
              <li key={e.id} className="flex items-baseline gap-3 py-2">
                <span className="w-24 shrink-0 text-sm font-bold text-ink-2" dir="ltr">
                  {e.allDay ? <span dir="rtl">{c.allDay}</span> : e.end ? `${e.start}–${e.end}` : e.start}
                </span>
                <span className="min-w-0 flex-1 text-base">{e.title}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

import type { ReactNode } from "react";
import { shortDate, weekdayOf } from "@/lib/dates";
import { strings } from "@/lib/strings";
import { addDays, byDue, dayKey, type TaskLike } from "@/lib/tasks";

const s = strings.tasks;

/**
 * My tasks one day at a time: a week strip to jump with one thumb, then
 * overdue, each date in order, and undated last.
 */
export function DayView<T extends TaskLike>({
  tasks,
  today,
  row,
}: {
  tasks: T[];
  today: string;
  row: (t: T) => ReactNode;
}) {
  const groups = new Map<string, T[]>();
  for (const t of [...tasks].sort(byDue)) {
    const k = dayKey(t, today);
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const dates = [...groups.keys()].filter((k) => k !== "overdue" && k !== "none").sort();
  const order = [...(groups.has("overdue") ? ["overdue"] : []), ...dates, ...(groups.has("none") ? ["none"] : [])];
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const title = (k: string) => {
    if (k === "overdue") return s.groups.overdue;
    if (k === "none") return s.noDate;
    const prefix = k === today ? `${s.today} · ` : k === addDays(today, 1) ? `${s.tomorrow} · ` : "";
    return `${prefix}${weekdayOf(k)} ${shortDate(k)}`;
  };

  return (
    <div className="mt-4">
      <nav aria-label={s.jumpToDay} className="grid grid-cols-7 gap-1">
        {week.map((d) => {
          const n = groups.get(d)?.length ?? 0;
          const isToday = d === today;
          const body = (
            <>
              <span className="text-xs font-bold">{weekdayOf(d)}</span>
              <span className="text-base font-extrabold leading-none">{shortDate(d).split(".")[0]}</span>
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${n ? (isToday ? "bg-now" : "bg-ink") : "bg-transparent"}`} />
            </>
          );
          const cls = `flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-[var(--radius-cell)] border ${
            isToday ? "border-board bg-board text-board-ink" : "border-rule bg-paper text-ink"
          }`;
          return n ? (
            <a key={d} href={`#day-${d}`} aria-label={`${title(d)}: ${s.dayCount(n)}`} className={cls}>
              {body}
            </a>
          ) : (
            <span key={d} aria-label={title(d)} className={`${cls} opacity-60`}>
              {body}
            </span>
          );
        })}
      </nav>

      {order.length === 0 ? <p className="mt-6 text-base text-ink-2">{s.emptyMine}</p> : null}
      {order.map((k) => {
        const items = groups.get(k) ?? [];
        return (
          <section key={k} id={`day-${k}`} className="mt-6 scroll-mt-4">
            <h2 className={`mb-1 text-base font-extrabold ${k === "overdue" ? "text-absent-ink" : ""}`}>
              {title(k)} <span className="text-sm font-medium text-ink-2">{items.length}</span>
            </h2>
            <ul className="divide-y divide-rule border-y border-rule">{items.map(row)}</ul>
          </section>
        );
      })}
    </div>
  );
}

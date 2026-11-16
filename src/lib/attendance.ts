import { strings } from "./strings";

export type Status = "present" | "late" | "absent";
export type Mark = { status: Status; reason: string | null };
type Person = { id: number; first_name: string; last_name: string };

const name = (p: Person) => [p.first_name, p.last_name].filter(Boolean).join(" ");

export function tally(marks: Map<number, Mark> | Record<number, Mark>, total: number) {
  const values = marks instanceof Map ? [...marks.values()] : Object.values(marks);
  const present = values.filter((m) => m.status === "present").length;
  const late = values.filter((m) => m.status === "late").length;
  const absent = values.filter((m) => m.status === "absent").length;
  return { present, late, absent, unmarked: Math.max(0, total - present - late - absent), total };
}

/** Plain-text summary to paste into a message. Contains names, statuses and reasons only. */
export function summaryText(opts: {
  label: string;
  teamName: string;
  date: string;
  roster: Person[];
  marks: Map<number, Mark>;
}) {
  const a = strings.attendance;
  const t = tally(opts.marks, opts.roster.length);
  const lines = [a.summaryTitle(opts.label || a.title, opts.teamName, opts.date), a.summaryPresent(t.present, t.total)];

  const group = (status: Status | "unmarked", title: string) => {
    const people = opts.roster.filter((p) => {
      const m = opts.marks.get(p.id);
      return status === "unmarked" ? !m : m?.status === status;
    });
    if (people.length === 0) return;
    lines.push(
      `${title}: ${people
        .map((p) => {
          const reason = opts.marks.get(p.id)?.reason?.trim();
          return reason ? `${name(p)} (${reason})` : name(p);
        })
        .join(", ")}`,
    );
  };
  group("late", a.late);
  group("absent", a.absent);
  group("unmarked", a.unmarked);
  return lines.join("\n");
}

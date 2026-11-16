import Link from "next/link";
import { strings } from "@/lib/strings";
import { fullName, type DutyRow, type Member } from "@/lib/data";
import { untilLabel } from "@/lib/dates";

const s = strings.board;

/** Brand-only band for pages outside a team (login, join, create). */
export function BoardHeader() {
  return (
    <header className="bg-board px-4 pb-5 pt-[max(env(safe-area-inset-top),1.25rem)] text-board-ink">
      <Link href="/" className="text-[1.75rem] font-extrabold leading-none">
        {strings.app.name}
      </Link>
    </header>
  );
}

/** The departure board: team identity, day, and today's role-holders as rows. */
export function TeamBoard({
  teamName,
  dayLabel,
  time,
  onDuty,
  nextUp,
  me,
  today,
  teamId,
  canManage,
}: {
  teamName: string;
  dayLabel: string;
  time: string;
  onDuty: DutyRow[];
  nextUp: DutyRow[];
  me: Member | null;
  today: string;
  teamId: number;
  canManage: boolean;
}) {
  return (
    <header className="bg-board pb-3 pt-[max(env(safe-area-inset-top),1rem)] text-board-ink">
      <div className="mx-auto max-w-xl px-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <Link href="/" className="text-[1.375rem] font-extrabold leading-tight">
            {strings.app.name}
          </Link>
          <p className="truncate text-sm text-board-dim">{teamName}</p>
        </div>
        <p className="shrink-0 text-sm font-bold text-now">
          {dayLabel} · {time}
        </p>
      </div>

      {onDuty.length === 0 ? (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-board-rule py-3 text-base text-board-dim">
          <span>{s.nobody}</span>
          {canManage ? (
            <Link
              href={`/t/${teamId}/team#assignments`}
              className="inline-flex min-h-11 items-center font-bold text-now underline"
            >
              {s.assign}
            </Link>
          ) : null}
        </div>
      ) : (
        <table className="mt-3 w-full table-fixed border-collapse text-start">
          <thead>
            <tr className="border-b border-board-rule text-xs text-board-dim">
              <th scope="col" className="w-[5.5rem] pb-1.5 text-start font-medium">{s.role}</th>
              <th scope="col" className="pb-1.5 text-start font-medium">{s.onDuty}</th>
              <th scope="col" className="w-14 pb-1.5 text-end font-medium">{s.until}</th>
            </tr>
          </thead>
          <tbody>
            {onDuty.map((d) => {
              const mine = me !== null && d.member.id === me.id;
              return (
                <tr
                  key={`${d.assignmentId}-${d.member.id}`}
                  className="h-10 border-b border-board-2 text-[0.9375rem] last:border-b-0"
                >
                  <td className="truncate font-bold text-now">{d.role.name}</td>
                  <td className={`truncate ${mine ? "font-bold" : ""}`}>
                    {fullName(d.member)}
                    {mine ? <span className="ms-1.5 text-xs font-normal text-board-dim">· {strings.common.you}</span> : null}
                  </td>
                  <td className="text-end text-sm text-board-dim">{untilLabel(d.endDate, today)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {nextUp.length > 0 ? (
        <p className="mt-1 flex gap-2 border-t border-board-rule pt-2 text-sm text-board-dim">
          <span className="shrink-0 font-bold">{s.tomorrow}</span>
          <span className="truncate">
            {nextUp.map((d) => `${d.role.name}: ${fullName(d.member)}`).join(" · ")}
          </span>
        </p>
      ) : null}
      </div>
    </header>
  );
}

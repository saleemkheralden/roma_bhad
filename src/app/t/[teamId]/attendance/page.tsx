import { Suspense } from "react";
import Link from "next/link";
import { getSessions, getTeamContext } from "@/lib/data";
import { dayLabel } from "@/lib/dates";
import { strings } from "@/lib/strings";
import { tally, type Mark } from "@/lib/attendance";
import { Section, TallyBar } from "@/components/section";
import { StartRollCall } from "../start-roll-call";
import { startRollCall } from "../actions";

const a = strings.attendance;

async function Attendance({ params }: { params: Promise<{ teamId: string }> }) {
  const teamId = Number((await params).teamId);
  const [ctx, sessions] = await Promise.all([getTeamContext(teamId), getSessions(teamId, 30)]);
  const total = ctx.roster.length;

  return (
    <>
      {ctx.permissions.can_command ? (
        <Section title={a.newTitle}>
          <StartRollCall action={startRollCall.bind(null, teamId)} defaultLabel={a.labels[0]} />
        </Section>
      ) : null}

      <Section title={a.history}>
        {sessions.length === 0 ? (
          <p className="text-base text-ink-2">{a.empty}</p>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {sessions.map((s) => {
              const marks = new Map<number, Mark>(
                s.attendance_entries.map((e) => [e.member_id, { status: e.status as Mark["status"], reason: null }]),
              );
              const t = tally(marks, total);
              return (
                <li key={s.id}>
                  <Link
                    href={`/t/${teamId}/attendance/${s.id}`}
                    className="grid min-h-14 grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3 hover:bg-paper"
                  >
                    <span className="leading-tight">
                      <span className="block text-sm font-bold">{s.label || a.title}</span>
                      <span className="block text-xs text-ink-2">{dayLabel(s.created_at)}</span>
                    </span>
                    <TallyBar present={t.present} late={t.late} total={total} />
                    <span className="text-end text-base font-bold">
                      {t.present}/{total}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}

export default function AttendancePage({ params }: PageProps<"/t/[teamId]/attendance">) {
  return (
    <Suspense fallback={<p className="text-ink-2">{strings.common.loading}</p>}>
      <Attendance params={params} />
    </Suspense>
  );
}

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getSession, getTeamContext } from "@/lib/data";
import { dayLabel } from "@/lib/dates";
import { strings } from "@/lib/strings";
import type { Mark } from "@/lib/attendance";
import { deleteSession } from "../../actions";
import { RollCall } from "./roll-call";

async function SessionView({ params }: { params: Promise<{ teamId: string; sessionId: string }> }) {
  const p = await params;
  const teamId = Number(p.teamId);
  const sessionId = Number(p.sessionId);
  const [ctx, session] = await Promise.all([getTeamContext(teamId), getSession(teamId, sessionId)]);
  if (!session) notFound();

  const initial: Record<number, Mark> = {};
  for (const e of session.attendance_entries) {
    initial[e.member_id] = { status: e.status as Mark["status"], reason: e.reason };
  }

  return (
    <RollCall
      teamId={teamId}
      sessionId={sessionId}
      label={session.label}
      teamName={ctx.team.name}
      date={dayLabel(session.created_at)}
      roster={ctx.roster.map(({ id, first_name, last_name }) => ({ id, first_name, last_name }))}
      initial={initial}
      canEdit={ctx.permissions.can_command}
      deleteAction={deleteSession.bind(null, teamId, sessionId)}
      backHref={`/t/${teamId}/attendance`}
      doneHref={`/t/${teamId}`}
    />
  );
}

export default function SessionPage({ params }: PageProps<"/t/[teamId]/attendance/[sessionId]">) {
  return (
    <Suspense fallback={<p className="text-ink-2">{strings.common.loading}</p>}>
      <SessionView params={params} />
    </Suspense>
  );
}

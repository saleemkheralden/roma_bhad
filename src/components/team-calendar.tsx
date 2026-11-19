import Link from "next/link";
import { calendarAccountEmail, getCalendarEvents } from "@/lib/google-calendar";
import { strings } from "@/lib/strings";
import { Agenda } from "./agenda";
import { CalendarEmbed } from "./calendar-embed";

const c = strings.calendar;

/**
 * The team's calendar: read by Roma's Google account when it's shared with it (works on
 * every phone), otherwise the Google embed (needs the viewer's own Google access + cookies).
 */
export async function TeamCalendar({
  ids,
  today,
  days = 7,
  canManage,
  teamId,
}: {
  ids: string[];
  today: string;
  days?: number;
  canManage: boolean;
  teamId: number;
}) {
  const result = await getCalendarEvents([...ids].sort(), today, days);

  if (result.status === "ok") {
    return (
      <>
        <Agenda events={result.events} today={today} days={days} />
        {canManage && result.notShared.length > 0 ? <ShareHint teamId={teamId} /> : null}
      </>
    );
  }

  return (
    <>
      <CalendarEmbed ids={ids} />
      {canManage && calendarAccountEmail() ? <ShareHint teamId={teamId} /> : null}
    </>
  );
}

function ShareHint({ teamId }: { teamId: number }) {
  return (
    <p className="mt-2 rounded-[var(--radius-cell)] bg-now-wash px-3 py-2 text-sm font-medium text-now-ink">
      {c.shareHintShort}{" "}
      <Link href={`/t/${teamId}/team#calendar`} className="font-bold underline">
        {c.shareHow}
      </Link>
    </p>
  );
}

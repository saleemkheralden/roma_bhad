import { Suspense } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import { fullName, getLinks, getSessions, getTasks, getTeamContext, type Task } from "@/lib/data";
import { isoDate } from "@/lib/dates";
import { strings } from "@/lib/strings";
import { tally, type Mark } from "@/lib/attendance";
import { bucketOf, byDue, doneForMe, isMine } from "@/lib/tasks";
import { buttonClass } from "@/components/button-class";
import { Section, TallyBar } from "@/components/section";
import { StartRollCall } from "./start-roll-call";
import { startRollCall } from "./actions";
import { TaskItem, type TaskContext } from "./tasks/task-item";

const t = strings.today;
const a = strings.attendance;

const c = strings.catchUp;

function israelHour() {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "numeric", hour12: false }).format(new Date()),
  );
}

function defaultLabel() {
  const hour = israelHour();
  const [morning, noon, evening] = a.labels;
  return hour < 11 ? morning : hour < 17 ? noon : evening;
}

async function Today({ params }: { params: Promise<{ teamId: string }> }) {
  const teamId = Number((await params).teamId);
  const [ctx, sessions, links, tasks] = await Promise.all([
    getTeamContext(teamId),
    getSessions(teamId, 5),
    getLinks(teamId),
    getTasks(teamId),
  ]);
  const latest = sessions.find((s) => isoDate(new Date(s.created_at)) === ctx.today);
  const total = ctx.roster.length;
  const canCommand = ctx.permissions.can_command;
  const start = startRollCall.bind(null, teamId);

  let rollCall = null;
  if (latest) {
    const marks = new Map<number, Mark>(
      latest.attendance_entries.map((e) => [e.member_id, { status: e.status as Mark["status"], reason: e.reason }]),
    );
    const tl = tally(marks, total);
    const exceptions = ctx.roster
      .map((m) => ({ m, mark: marks.get(m.id) }))
      .filter(({ mark }) => mark?.status === "late" || mark?.status === "absent");

    rollCall = (
      <>
        <div className="rounded-[var(--radius-control)] border border-rule bg-paper">
          <div className="flex items-baseline justify-between gap-3 px-4 pt-3">
            <span className="text-lg font-bold">{latest.label || a.title}</span>
            <span className="text-lg font-extrabold">
              {tl.present}/{total} <span className="text-sm font-medium text-ink-2">{a.present}</span>
            </span>
          </div>
          <div className="px-4 pb-3 pt-2">
            <TallyBar present={tl.present} late={tl.late} total={total} />
          </div>
          <ul className="divide-y divide-rule border-t border-rule">
            {exceptions.length === 0 ? (
              <li className="px-4 py-2.5 text-sm text-ink-2">
                {tl.unmarked > 0 ? `${a.unmarked}: ${tl.unmarked}` : t.allPresent}
              </li>
            ) : (
              exceptions.map(({ m, mark }) => (
                <li key={m.id} className="flex items-baseline gap-2 px-4 py-2.5 text-sm">
                  <span className={`w-12 shrink-0 font-bold ${mark?.status === "late" ? "text-now-ink" : "text-absent-ink"}`}>
                    {mark?.status === "late" ? a.late : a.absent}
                  </span>
                  <span className="font-bold">{fullName(m)}</span>
                  {mark?.reason ? <span className="truncate text-ink-2">· {mark.reason}</span> : null}
                </li>
              ))
            )}
          </ul>
        </div>
        <Link href={`/t/${teamId}/attendance/${latest.id}`} className={buttonClass("primary", "mt-3 w-full")}>
          {t.continueLast}
        </Link>
        {canCommand ? (
          <details className="group mt-3">
            <summary className="flex h-11 cursor-pointer list-none items-center gap-1 text-sm font-bold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
              {t.newRollCall}
              <ChevronDown aria-hidden size={18} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="pt-2">
              <StartRollCall action={start} defaultLabel={defaultLabel()} submitVariant="outline" />
            </div>
          </details>
        ) : null}
      </>
    );
  }

  const myId = ctx.me?.id ?? null;
  const taskCtx: TaskContext = {
    teamId,
    today: ctx.today,
    myId,
    canCommand,
    members: ctx.roster.map((m) => ({ id: m.id, name: fullName(m) })),
  };
  const taskRow = (task: Task) => <TaskItem key={task.id} task={task} ctx={taskCtx} />;
  const open = tasks.filter((x) => x.status === "open");
  const myDay = open
    .filter((x) => isMine(x, myId) && !doneForMe(x, myId) && ["overdue", "today"].includes(bucketOf(x, ctx.today)))
    .sort(byDue);
  const newToday = tasks
    .filter((x) => x.visibility === "team" && isoDate(new Date(x.created_at)) === ctx.today)
    .sort(byDue);
  const dueTomorrow = open
    .filter((x) => bucketOf(x, ctx.today) === "tomorrow" && isMine(x, myId) && !doneForMe(x, myId))
    .sort(byDue);
  const evening = israelHour() >= 17;

  const tasksLink = (
    <Link href={`/t/${teamId}/tasks`} className="inline-flex min-h-11 items-center text-sm font-bold underline">
      {strings.tasks.all}
    </Link>
  );

  const myDaySection = (
    <Section key="my-day" title={c.myDay} aside={tasksLink}>
      {myDay.length === 0 ? (
        <p className="text-base text-ink-2">{c.myDayEmpty}</p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">{myDay.slice(0, 6).map(taskRow)}</ul>
      )}
    </Section>
  );

  const catchUpSection = (
    <Section key="catch-up" title={c.title}>
      {newToday.length === 0 && dueTomorrow.length === 0 ? (
        <p className="text-base text-ink-2">{c.nothing}</p>
      ) : (
        <>
          {newToday.length > 0 ? (
            <>
              <h3 className="mb-1 text-sm font-extrabold text-ink-2">{c.newToday}</h3>
              <ul className="mb-4 divide-y divide-rule border-y border-rule">{newToday.slice(0, 8).map(taskRow)}</ul>
            </>
          ) : null}
          {dueTomorrow.length > 0 ? (
            <>
              <h3 className="mb-1 text-sm font-extrabold text-ink-2">{c.dueTomorrow}</h3>
              <ul className="divide-y divide-rule border-y border-rule">{dueTomorrow.slice(0, 8).map(taskRow)}</ul>
            </>
          ) : null}
        </>
      )}
    </Section>
  );

  return (
    <>
      {evening ? catchUpSection : null}
      <Section title={t.rollCall}>
        {rollCall ?? (
          <>
            <p className="mb-4 text-base text-ink-2">{t.noneToday}</p>
            {canCommand ? (
              <StartRollCall action={start} defaultLabel={defaultLabel()} />
            ) : (
              <p className="rounded-[var(--radius-cell)] bg-paper px-3 py-2 text-sm text-ink-2">{t.onlyCommand}</p>
            )}
          </>
        )}
      </Section>

      {myDaySection}
      {evening ? null : catchUpSection}

      <Section
        title={t.links}
        aside={
          <Link href={`/t/${teamId}/links`} className="inline-flex min-h-11 items-center text-sm font-bold underline">
            {t.allLinks}
          </Link>
        }
      >
        {links.length === 0 ? (
          <p className="text-base text-ink-2">{strings.links.empty}</p>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {links.slice(0, 5).map((l) => (
              <li key={l.id}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center justify-between gap-3 text-base font-medium hover:bg-paper"
                >
                  {l.title}
                  <ExternalLink aria-hidden size={18} className="shrink-0 text-ink-2" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

export default function TodayPage({ params }: PageProps<"/t/[teamId]">) {
  return (
    <Suspense fallback={<p className="text-ink-2">{strings.common.loading}</p>}>
      <Today params={params} />
    </Suspense>
  );
}

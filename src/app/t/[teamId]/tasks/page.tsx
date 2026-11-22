import { Suspense } from "react";
import Link from "next/link";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { fullName, getTaskLanes, getTaskLayout, getTasks, getTeamContext, type Task } from "@/lib/data";
import { strings } from "@/lib/strings";
import {
  BUCKETS,
  LANES,
  bucketOf,
  byDue,
  byPlacement,
  canToggle,
  doneForMe,
  dueLabel,
  isMine,
  isTeamWide,
  laneOf,
  type Lane,
} from "@/lib/tasks";
import { ActionButton } from "@/components/action-button";
import { EditArea } from "@/components/edit-area";
import { createTask, deleteTask, moveTask, setTaskLayout } from "../actions";
import { DayView } from "./day-view";
import { LayoutSwitch } from "./layout-switch";
import { NewTaskForm } from "./new-task-form";
import { TaskBoard, type BoardCard } from "./task-board";
import { ChecklistFor, TaskItem, type TaskContext } from "./task-item";

const s = strings.tasks;
type View = "mine" | "team" | "private";

async function Tasks({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const teamId = Number((await params).teamId);
  const requested = (await searchParams).view;
  const view: View = requested === "team" || requested === "private" ? requested : "mine";
  const [ctx, tasks, placementRows, layout] = await Promise.all([
    getTeamContext(teamId),
    getTasks(teamId),
    getTaskLanes(teamId),
    getTaskLayout(),
  ]);
  const placements = new Map(placementRows.map((p) => [p.task_id, p]));
  const canCommand = ctx.permissions.can_command;
  const myId = ctx.me?.id ?? null;

  const inView = (t: Task) =>
    view === "team" ? t.visibility === "team" : view === "private" ? t.visibility === "private" : isMine(t, myId);
  const visible = tasks.filter(inView).sort(byDue);
  // In "mine", a team-wide task counts as done once my part is done; elsewhere only when closed.
  const isDone = (t: Task) => (view === "mine" ? doneForMe(t, myId) : t.status === "done");
  const open = visible.filter((t) => !isDone(t));
  const done = visible.filter(isDone);
  const deletable = tasks.filter((t) => (t.visibility === "private" ? true : canCommand));

  const taskCtx: TaskContext = {
    teamId,
    today: ctx.today,
    myId,
    canCommand,
    members: ctx.roster.map((m) => ({ id: m.id, name: fullName(m) })),
    doingIds: placementRows.filter((p) => p.lane === "doing").map((p) => p.task_id),
  };
  const row = (t: Task) => <TaskItem key={t.id} task={t} ctx={taskCtx} />;

  const list =
    open.length === 0 ? (
      <p className="mt-6 text-base text-ink-2">{view === "mine" ? s.emptyMine : s.empty}</p>
    ) : (
      BUCKETS.map((b) => {
        const items = open.filter((t) => bucketOf(t, ctx.today) === b);
        if (items.length === 0) return null;
        return (
          <section key={b} className="mt-6">
            <h2 className={`mb-1 text-base font-extrabold ${b === "overdue" ? "text-absent-ink" : ""}`}>
              {s.groups[b]} <span className="text-sm font-medium text-ink-2">{items.length}</span>
            </h2>
            <ul className="divide-y divide-rule border-y border-rule">{items.map(row)}</ul>
          </section>
        );
      })
    );

  // Finished in the last week; the board shows these in its own "done" lane.
  const doneSection = done.length > 0 ? (
        <details className="group mt-6">
          <summary className="flex h-11 cursor-pointer list-none items-center gap-1 text-base font-extrabold [&::-webkit-details-marker]:hidden">
            {s.done} <span className="text-sm font-medium text-ink-2">{done.length}</span>
            <ChevronDown aria-hidden size={18} className="text-ink-2 transition-transform group-open:rotate-180" />
          </summary>
          <ul className="divide-y divide-rule border-y border-rule">{done.map(row)}</ul>
        </details>
      ) : null;

  // Personal views apply to my own tasks; the whole-team view stays a list.
  const personal = view !== "team";
  let panes = null;
  if (personal) {
    const memberName = (id: number | null) => taskCtx.members.find((m) => m.id === id)?.name ?? "";
    const cards: BoardCard[] = visible.map((t) => {
      const wide = isTeamWide(t);
      return {
        id: t.id,
        title: t.title,
        notes: t.notes,
        due: dueLabel(t, ctx.today),
        overdue: bucketOf(t, ctx.today) === "overdue",
        who: t.visibility === "private" ? "" : wide ? s.everyone : memberName(t.assignee_member_id),
        isPrivate: t.visibility === "private",
        progress: wide
          ? s.progress(
              t.task_completions.filter((c) => taskCtx.members.some((m) => m.id === c.member_id)).length,
              taskCtx.members.length,
            )
          : "",
        checklist: <ChecklistFor task={t} ctx={taskCtx} />,
        teamWide: wide,
        // Team-wide: my own part, while the task is open. Otherwise: who may tick it.
        canFinish: wide ? myId !== null && t.status === "open" : canToggle(t, myId, canCommand),
      };
    });
    const columns = Object.fromEntries(LANES.map((l) => [l, [] as number[]])) as Record<Lane, number[]>;
    const ordered = [...visible].sort(byPlacement(placements));
    for (const t of ordered) columns[laneOf(t, myId, placements.get(t.id))].push(t.id);
    // Finished cards: most recently done first.
    const doneAt = (t: Task) => t.done_at ?? t.created_at;
    columns.done = visible
      .filter((t) => columns.done.includes(t.id))
      .sort((a, b) => (doneAt(a) < doneAt(b) ? 1 : -1))
      .map((t) => t.id);

    panes = {
      list,
      board: <TaskBoard cards={cards} columns={columns} myId={myId} move={moveTask.bind(null, teamId)} />,
      days: <DayView tasks={open} today={ctx.today} row={row} />,
    };
  }

  return (
    <>
      <h1 className="sr-only">{s.title}</h1>

      <details className="group">
        <summary className="flex h-12 cursor-pointer list-none items-center justify-center gap-2 rounded-[var(--radius-control)] border border-ink bg-paper text-base font-bold hover:bg-ground [&::-webkit-details-marker]:hidden">
          <Plus aria-hidden size={20} />
          {s.new}
          <ChevronDown aria-hidden size={18} className="text-ink-2 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-2 rounded-[var(--radius-control)] border border-rule bg-paper p-4">
          <NewTaskForm
            action={createTask.bind(null, teamId)}
            canCommand={canCommand}
            members={ctx.roster.map((m) => ({ id: m.id, name: fullName(m) }))}
            today={ctx.today}
          />
        </div>
      </details>

      <nav aria-label={s.viewsLabel} className="mt-5 grid grid-cols-3 gap-1.5">
        {(["mine", "team", "private"] as const).map((v) => (
          <Link
            key={v}
            href={v === "mine" ? `/t/${teamId}/tasks` : `/t/${teamId}/tasks?view=${v}`}
            aria-current={view === v ? "page" : undefined}
            className={`flex h-11 items-center justify-center rounded-[var(--radius-cell)] border text-sm font-bold ${
              view === v ? "border-board bg-board text-board-ink" : "border-rule bg-paper text-ink-2"
            }`}
          >
            {s.views[v]}
          </Link>
        ))}
      </nav>

      {panes ? (
        <LayoutSwitch initial={layout} save={setTaskLayout} panes={panes} afterList={doneSection} />
      ) : (
        <>
          <p className="mt-3 text-xs text-ink-2">{s.teamIsList}</p>
          {list}
          {doneSection}
        </>
      )}



      {deletable.length > 0 ? (
        <div className="mt-10">
          <EditArea
            title={s.manage}
            remove={
              <ul className="flex flex-col gap-2">
                {deletable.sort(byDue).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-bold">{t.title}</span>
                    <ActionButton
                      action={deleteTask.bind(null, teamId, t.id)}
                      confirm={s.confirmDelete(t.title)}
                      label={`${strings.common.remove} ${t.title}`}
                      variant="icon-danger"
                    >
                      <Trash2 aria-hidden size={18} />
                    </ActionButton>
                  </li>
                ))}
              </ul>
            }
          />
        </div>
      ) : null}
    </>
  );
}

export default function TasksPage({ params, searchParams }: PageProps<"/t/[teamId]/tasks">) {
  return (
    <Suspense fallback={<p className="text-ink-2">{strings.common.loading}</p>}>
      <Tasks params={params} searchParams={searchParams as Promise<{ view?: string }>} />
    </Suspense>
  );
}

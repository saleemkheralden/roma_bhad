import type { Task } from "@/lib/data";
import { strings } from "@/lib/strings";
import { bucketOf, canToggle, dueLabel, isTeamWide } from "@/lib/tasks";
import { setCompletion, setTaskDone, updateTask } from "../actions";
import { EditTask } from "./edit-task";
import { TaskRow } from "./task-row";
import { TeamWideTaskRow } from "./team-wide-task-row";

export type TaskContext = {
  teamId: number;
  today: string;
  myId: number | null;
  canCommand: boolean;
  members: { id: number; name: string }[];
};

/** One task in a list: a per-cadet row for open team-wide tasks, a plain row otherwise. */
export function TaskItem({ task, ctx }: { task: Task; ctx: TaskContext }) {
  const due = dueLabel(task, ctx.today);
  const overdue = bucketOf(task, ctx.today) === "overdue";
  const done = (task.task_completions ?? []).map((c) => c.member_id);
  // Remount when the task opens/closes; completions resync inside the row without remounting.
  const key = `${task.id}-${task.status}`;
  const isTeam = task.visibility === "team";
  // Mirrors RLS: command edits team tasks; private tasks are only ever visible to their owner.
  const canEdit = task.status === "open" && (isTeam ? ctx.canCommand : true);
  const editor = canEdit ? (
    <EditTask
      key={`${task.id}-${task.title}-${task.due_on}-${task.due_time}-${task.assignee_member_id}-${task.notes}`}
      action={updateTask.bind(null, ctx.teamId, task.id, isTeam)}
      title={task.title}
      notes={task.notes}
      dueOn={task.due_on}
      dueTime={task.due_time}
      assignee={task.assignee_member_id}
      isTeam={isTeam}
      members={ctx.members}
    />
  ) : null;

  if (isTeamWide(task) && task.status === "open") {
    return (
      <TeamWideTaskRow
        key={key}
        title={task.title}
        notes={task.notes}
        due={due}
        overdue={overdue}
        members={ctx.members}
        initialDone={done}
        myId={ctx.myId}
        canCommand={ctx.canCommand}
        setCompletion={setCompletion.bind(null, ctx.teamId, task.id)}
        closeTask={setTaskDone.bind(null, ctx.teamId, task.id)}
        editor={editor}
      />
    );
  }

  const who =
    task.visibility === "private"
      ? ""
      : task.assignee_member_id
        ? ctx.members.find((m) => m.id === task.assignee_member_id)?.name ?? ""
        : strings.tasks.everyone;
  return (
    <TaskRow
      key={key}
      title={task.title}
      notes={task.notes}
      due={due}
      overdue={overdue}
      who={who}
      isPrivate={task.visibility === "private"}
      done={task.status === "done"}
      canToggle={canToggle(task, ctx.myId, ctx.canCommand)}
      toggle={setTaskDone.bind(null, ctx.teamId, task.id)}
      editor={editor}
    />
  );
}

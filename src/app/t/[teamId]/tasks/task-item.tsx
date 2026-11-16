import type { Task } from "@/lib/data";
import { strings } from "@/lib/strings";
import { bucketOf, canToggle, dueLabel, isTeamWide } from "@/lib/tasks";
import { setCompletion, setTaskDone } from "../actions";
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
    />
  );
}

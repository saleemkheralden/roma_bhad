import { shortDate, weekdayOf } from "./dates";
import { strings } from "./strings";

export type TaskLike = {
  id: number;
  visibility: string;
  title: string;
  due_on: string | null;
  due_time: string | null;
  status: string;
  assignee_member_id: number | null;
  owner_id: string | null;
  created_at: string;
  task_completions?: { member_id: number }[];
  task_checklist_items?: { id: number; position: number; done: boolean }[];
};

/** What this viewer may do with a task's checklist: add/remove steps, only tick them, or just read. */
export type ChecklistAccess = "edit" | "tick" | "read";

export type Bucket = "overdue" | "today" | "tomorrow" | "later" | "none";
export const BUCKETS: Bucket[] = ["overdue", "today", "tomorrow", "later", "none"];

export function addDays(iso: string, days: number) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export function bucketOf(t: Pick<TaskLike, "due_on">, today: string): Bucket {
  if (!t.due_on) return "none";
  if (t.due_on < today) return "overdue";
  if (t.due_on === today) return "today";
  if (t.due_on === addDays(today, 1)) return "tomorrow";
  return "later";
}

/** "היום 14:00", "מחר", "ה׳ 20.11", with the time when set. */
export function dueLabel(t: Pick<TaskLike, "due_on" | "due_time">, today: string) {
  if (!t.due_on) return "";
  const s = strings.tasks;
  const b = bucketOf(t, today);
  const day =
    b === "today" ? s.today : b === "tomorrow" ? s.tomorrow : `${weekdayOf(t.due_on)} ${shortDate(t.due_on)}`;
  return t.due_time ? `${day} ${t.due_time.slice(0, 5)}` : day;
}

/** Sort: by date (undated last), then time, then newest first. */
export function byDue(a: TaskLike, b: TaskLike) {
  const da = a.due_on ?? "9999-12-31";
  const db = b.due_on ?? "9999-12-31";
  if (da !== db) return da < db ? -1 : 1;
  const ta = a.due_time ?? "99";
  const tb = b.due_time ?? "99";
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.created_at < b.created_at ? 1 : -1;
}

/** Mine = my private tasks, team tasks assigned to me, and team-wide tasks. */
export function isMine(t: TaskLike, myMemberId: number | null) {
  return (
    t.visibility === "private" ||
    t.assignee_member_id === null ||
    (myMemberId !== null && t.assignee_member_id === myMemberId)
  );
}

/** A team task for the whole team: each cadet marks their own part. */
export function isTeamWide(t: TaskLike) {
  return t.visibility === "team" && t.assignee_member_id === null;
}

/** Done from this viewer's point of view: closed, or my part of a team-wide task is done. */
export function doneForMe(t: TaskLike, myMemberId: number | null) {
  if (t.status === "done") return true;
  return isTeamWide(t) && myMemberId !== null && (t.task_completions ?? []).some((c) => c.member_id === myMemberId);
}

/** Whether this viewer may tick the task (mirrors RLS; the database still decides). */
export function canToggle(t: TaskLike, myMemberId: number | null, canCommand: boolean) {
  if (t.visibility === "private") return true;
  return canCommand || (myMemberId !== null && t.assignee_member_id === myMemberId);
}

// Personal views (issue #1) ----------------------------------------------------

export type TaskLayout = "list" | "board" | "days";
export const LAYOUTS: TaskLayout[] = ["list", "board", "days"];
export function asLayout(v: string | null | undefined): TaskLayout {
  return v === "board" || v === "days" ? v : "list";
}

/** Board lanes, in reading order (right to left in RTL). Only "doing" is stored; "done" comes from the task. */
export type Lane = "todo" | "doing" | "done";
export const LANES: Lane[] = ["todo", "doing", "done"];
export type Placement = { task_id: number; lane: string; position: number };

/** Where a task sits on this viewer's board. */
export function laneOf(t: TaskLike, myMemberId: number | null, placement: Placement | undefined): Lane {
  if (doneForMe(t, myMemberId)) return "done";
  return placement?.lane === "doing" ? "doing" : "todo";
}

/** Card order within a lane: placed cards by position, then the rest by due date. */
export function byPlacement(placements: Map<number, Placement>) {
  return (a: TaskLike, b: TaskLike) => {
    const pa = placements.get(a.id)?.position;
    const pb = placements.get(b.id)?.position;
    if (pa !== undefined && pb !== undefined && pa !== pb) return pa - pb;
    if (pa !== undefined && pb === undefined) return -1;
    if (pa === undefined && pb !== undefined) return 1;
    return byDue(a, b);
  };
}

/** Day groups for the "by day" view: overdue, then each date, then undated. */
export function dayKey(t: Pick<TaskLike, "due_on">, today: string): string {
  if (!t.due_on) return "none";
  return t.due_on < today ? "overdue" : t.due_on;
}

/**
 * Mirrors private.checklist_access and can_tick_own_step (the database still decides): the owner
 * edits a private task's steps, command edits a team task's, the assignee ticks theirs, and on a
 * team-wide task every cadet ticks their own copy. Closed: read-only.
 */
export function checklistAccess(t: TaskLike, myMemberId: number | null, canCommand: boolean): ChecklistAccess {
  if (t.status !== "open") return "read";
  if (t.visibility === "private" || canCommand) return "edit";
  if (myMemberId === null) return "read";
  return isTeamWide(t) || t.assignee_member_id === myMemberId ? "tick" : "read";
}

/** Steps in their saved order (position, then creation order). */
export function sortSteps<T extends { id: number; position: number }>(items: T[]) {
  return [...items].sort((a, b) => a.position - b.position || a.id - b.id);
}

/** "Step one\n2. step two\n- step three" -> ["Step one", "step two", "step three"]: max 20, 120 chars each. */
export function parseSteps(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•▪◦]|\[[ xX]?\])\s*/, "").trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 20);
}

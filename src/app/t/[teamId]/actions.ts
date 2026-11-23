"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { notifyAssignment, notifyTeamTask } from "@/lib/notify";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { strings } from "@/lib/strings";
import type { ActionResult } from "@/components/ui";
import { parseCalendarIds } from "@/lib/calendar";
import { calendarAccountEmail, probeCalendar } from "@/lib/google-calendar";
import { LANES, LAYOUTS, parseSteps, type Lane, type TaskLayout } from "@/lib/tasks";

// Permissions are enforced by RLS and triggers in the database; these
// functions only shape input and translate errors into Hebrew.

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(error: PostgrestError | null): ActionResult {
  if (!error) return { error: strings.common.genericError };
  if (error.code === "42501") return { error: strings.common.noPermission };
  if (error.code === "23514" && error.message.includes("admin")) return { error: strings.team.lastAdmin };
  return { error: strings.common.genericError };
}

/** Runs a write; RLS silently filtering an update/delete to 0 rows counts as "no permission". */
async function run(
  write: (supabase: Awaited<ReturnType<typeof createClient>>) => PromiseLike<{
    error: PostgrestError | null;
    count?: number | null;
  }>,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error, count } = await write(supabase);
  if (error) return fail(error);
  if (count === 0) return { error: strings.common.noPermission };
  refresh();
  return { ok: true };
}

// Roster ---------------------------------------------------------------------

export async function addMember(teamId: number, _p: ActionResult, formData: FormData) {
  const first = text(formData, "first_name");
  if (!first) return { error: strings.common.genericError };
  return run((db) =>
    db.from("team_members").insert({ team_id: teamId, first_name: first, last_name: text(formData, "last_name") }),
  );
}

export async function updateMember(teamId: number, memberId: number, _p: ActionResult, formData: FormData) {
  const first = text(formData, "first_name");
  if (!first) return { error: strings.common.genericError };
  return run((db) =>
    db
      .from("team_members")
      .update({ first_name: first, last_name: text(formData, "last_name") }, { count: "exact" })
      .eq("team_id", teamId)
      .eq("id", memberId),
  );
}

/** One name per line: "first last…", or two columns (tab/comma) pasted from a sheet. */
export async function importMembers(teamId: number, _p: ActionResult, formData: FormData): Promise<ActionResult> {
  const lines = String(formData.get("names") ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\d+[.)\-]?\s*/, "").trim()) // drop "1." / "2)" numbering
    .filter(Boolean);
  if (lines.length === 0) return { error: strings.team.pasteEmpty };
  if (lines.length > 60) return { error: strings.team.pasteTooMany };

  const people = lines.map((line) => {
    const parts = /[\t,]/.test(line) ? line.split(/[\t,]/) : line.split(/\s+/);
    const [first, ...rest] = parts.map((p) => p.trim()).filter(Boolean);
    return { first_name: (first ?? "").slice(0, 40), last_name: rest.join(" ").slice(0, 40) };
  });

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("team_members")
    .select("first_name, last_name")
    .eq("team_id", teamId);
  if (readError) return fail(readError);

  const key = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`.replace(/\s+/g, " ").trim();
  const seen = new Set((existing ?? []).map(key));
  const fresh = people.filter((p) => {
    const k = key(p);
    if (!p.first_name || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (fresh.length > 0) {
    const { error } = await supabase.from("team_members").insert(fresh.map((p) => ({ team_id: teamId, ...p })));
    if (error) return fail(error);
  }
  refresh();
  return { ok: true, message: strings.team.pasteResult(fresh.length, people.length - fresh.length) };
}

export async function removeMember(teamId: number, memberId: number) {
  return run((db) =>
    db.from("team_members").delete({ count: "exact" }).eq("team_id", teamId).eq("id", memberId),
  );
}

export async function setMemberFlag(teamId: number, memberId: number, flag: "is_admin" | "is_staff", value: boolean) {
  return run((db) =>
    db
      .from("team_members")
      .update(flag === "is_admin" ? { is_admin: value } : { is_staff: value }, { count: "exact" })
      .eq("team_id", teamId)
      .eq("id", memberId),
  );
}

export async function regenerateInvite(teamId: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_invite_code", { p_team_id: teamId });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

// End of course: delete the whole team -----------------------------------------

/** Admins only (RLS). The typed team name guards against a mis-tap; everything cascades. */
export async function deleteTeam(teamId: number, _p: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: team } = await supabase.from("teams").select("name").eq("id", teamId).maybeSingle();
  if (!team) return { error: strings.common.noPermission };
  if (text(formData, "confirm_name") !== team.name.trim()) return { error: strings.data.nameMismatch };
  const { error, count } = await supabase.from("teams").delete({ count: "exact" }).eq("id", teamId);
  if (error) return fail(error);
  if (count === 0) return { error: strings.common.noPermission };
  redirect("/");
}

// Roles and assignments ------------------------------------------------------

export async function addRole(teamId: number, _p: ActionResult, formData: FormData) {
  const name = text(formData, "name");
  if (!name) return { error: strings.common.genericError };
  return run((db) => db.from("team_roles").insert({ team_id: teamId, name, sort_order: 100 }));
}

export async function removeRole(teamId: number, roleId: number) {
  return run((db) => db.from("team_roles").delete({ count: "exact" }).eq("team_id", teamId).eq("id", roleId));
}

export async function addAssignment(teamId: number, _p: ActionResult, formData: FormData) {
  const roleId = Number(text(formData, "role_id"));
  const memberId = Number(text(formData, "member_id"));
  const start = text(formData, "start_date");
  const end = text(formData, "end_date") || start;
  if (!roleId || !memberId || !start || end < start) return { error: strings.common.genericError };
  const result = await run((db) =>
    db.from("role_assignments").insert({
      team_id: teamId,
      role_id: roleId,
      member_id: memberId,
      start_date: start,
      end_date: end,
    }),
  );
  if (result?.ok) after(() => notifyAssignment(teamId, memberId, roleId, start, end));
  return result;
}

export async function updateRole(teamId: number, roleId: number, _p: ActionResult, formData: FormData) {
  const name = text(formData, "name");
  if (!name) return { error: strings.common.genericError };
  return run((db) =>
    db
      .from("team_roles")
      .update({ name, is_command: formData.get("is_command") === "on" }, { count: "exact" })
      .eq("team_id", teamId)
      .eq("id", roleId),
  );
}

/** Change who holds a role and when (extend, shorten, move, or hand it to someone else). */
export async function updateAssignment(teamId: number, assignmentId: number, _p: ActionResult, formData: FormData) {
  const roleId = Number(text(formData, "role_id"));
  const memberId = Number(text(formData, "member_id"));
  const start = text(formData, "start_date");
  const end = text(formData, "end_date") || start;
  if (!roleId || !memberId || !start) return { error: strings.common.genericError };
  if (end < start) return { error: strings.roleEditing.badDates };
  return run((db) =>
    db
      .from("role_assignments")
      .update({ role_id: roleId, member_id: memberId, start_date: start, end_date: end }, { count: "exact" })
      .eq("team_id", teamId)
      .eq("id", assignmentId),
  );
}

export async function removeAssignment(teamId: number, assignmentId: number) {
  return run((db) =>
    db.from("role_assignments").delete({ count: "exact" }).eq("team_id", teamId).eq("id", assignmentId),
  );
}

// Roll call ------------------------------------------------------------------

export async function startRollCall(teamId: number, _p: ActionResult, formData: FormData): Promise<ActionResult> {
  const preset = text(formData, "label");
  const label = (preset === "custom" ? text(formData, "custom_label") : preset).slice(0, 60);
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .insert({ team_id: teamId, label, created_by: claims?.claims?.sub })
    .select("id")
    .single();
  if (error || !data) return fail(error);
  redirect(`/t/${teamId}/attendance/${data.id}`);
}

export async function deleteSession(teamId: number, sessionId: number) {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("attendance_sessions")
    .delete({ count: "exact" })
    .eq("team_id", teamId)
    .eq("id", sessionId);
  if (error) return fail(error);
  if (count === 0) return { error: strings.common.noPermission };
  redirect(`/t/${teamId}/attendance`);
}

// Tasks ----------------------------------------------------------------------

export async function createTask(teamId: number, _p: ActionResult, formData: FormData): Promise<ActionResult> {
  const title = text(formData, "title");
  const visibility = text(formData, "visibility") === "team" ? "team" : "private";
  const dueOn = text(formData, "due_on") || null;
  const dueTime = dueOn ? text(formData, "due_time") || null : null;
  const assignee = visibility === "team" ? Number(text(formData, "assignee_member_id")) || null : null;
  if (!title) return { error: strings.common.genericError };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      team_id: teamId,
      visibility,
      title: title.slice(0, 120),
      notes: text(formData, "notes").slice(0, 500),
      due_on: dueOn,
      due_time: dueTime,
      assignee_member_id: assignee,
      created_by: claims?.claims?.sub,
    })
    .select("id")
    .single();
  if (error || !data) return fail(error);
  if (visibility === "team") {
    const creator = (claims?.claims?.sub as string | undefined) ?? null;
    after(() => notifyTeamTask(teamId, title.slice(0, 120), assignee, creator));
  }
  const steps = parseSteps(String(formData.get("steps") ?? ""));
  if (steps.length > 0) {
    const { error: stepsError } = await supabase
      .from("task_checklist_items")
      .insert(steps.map((s, i) => ({ task_id: data.id, team_id: teamId, text: s, position: i + 1 })));
    if (stepsError) {
      refresh(); // the task itself was saved
      return failSteps(stepsError);
    }
  }
  refresh();
  return { ok: true };
}

export async function setTaskDone(teamId: number, taskId: number, done: boolean) {
  return run((db) =>
    db
      .from("tasks")
      .update({ status: done ? "done" : "open" }, { count: "exact" })
      .eq("team_id", teamId)
      .eq("id", taskId),
  );
}

/** Edit a task's text, notes, due date/time and (team tasks) assignee. RLS + trigger decide who may. */
export async function updateTask(
  teamId: number,
  taskId: number,
  isTeam: boolean,
  _p: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = text(formData, "title");
  if (!title) return { error: strings.common.genericError };
  const dueOn = text(formData, "due_on") || null;
  const changes = {
    title: title.slice(0, 120),
    notes: text(formData, "notes").slice(0, 500),
    due_on: dueOn,
    due_time: dueOn ? text(formData, "due_time") || null : null,
    ...(isTeam ? { assignee_member_id: Number(text(formData, "assignee_member_id")) || null } : {}),
  };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("tasks")
    .update(changes, { count: "exact" })
    .eq("team_id", teamId)
    .eq("id", taskId);
  if (error) return fail(error);
  if (count === 0) return { error: strings.common.noPermission };
  refresh();
  return { ok: true };
}

/** Mark or unmark one cadet's part of a team-wide task (own part, or anyone's for command). */
export async function setCompletion(teamId: number, taskId: number, memberId: number, done: boolean) {
  if (done) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("task_completions")
      .insert({ task_id: taskId, team_id: teamId, member_id: memberId });
    if (error && error.code !== "23505") return fail(error); // already marked is fine
    refresh();
    return { ok: true };
  }
  return run((db) =>
    db
      .from("task_completions")
      .delete({ count: "exact" })
      .eq("team_id", teamId)
      .eq("task_id", taskId)
      .eq("member_id", memberId),
  );
}

// Personal task views (issue #1) ----------------------------------------------

/** Save my task layout. Personal: it changes nothing for anyone else. */
export async function setTaskLayout(layout: TaskLayout): Promise<ActionResult> {
  if (!LAYOUTS.includes(layout)) return { error: strings.common.genericError };
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_settings")
    .upsert({ task_layout: layout, updated_at: new Date().toISOString() });
  if (error) return fail(error);
  return { ok: true };
}

/**
 * Move a card on my board. `order` is the target lane's task ids after the move.
 * "done" goes through the task itself (status, or my part of a team-wide task),
 * so RLS and the tasks trigger still decide; lanes and order are personal only.
 */
export async function moveTask(
  teamId: number,
  taskId: number,
  move: { from: Lane; to: Lane; teamWide: boolean; myMemberId: number | null; order: number[] },
): Promise<ActionResult> {
  const { from, to, teamWide, myMemberId } = move;
  if (!LANES.includes(from) || !LANES.includes(to)) return { error: strings.common.genericError };
  const order = move.order.filter(Number.isInteger).slice(0, 300);
  const supabase = await createClient();

  if (from !== to && (from === "done" || to === "done")) {
    const done = to === "done";
    const result =
      teamWide && myMemberId !== null
        ? await setCompletion(teamId, taskId, myMemberId, done)
        : await setTaskDone(teamId, taskId, done);
    if (result?.error) return result;
  }

  if (to !== "done") {
    const now = new Date().toISOString();
    const rows = (order.includes(taskId) ? order : [...order, taskId]).map((id, position) => ({
      task_id: id,
      team_id: teamId,
      lane: to,
      position,
      updated_at: now,
    }));
    const { error } = await supabase.from("task_lanes").upsert(rows);
    if (error) return fail(error);
  }
  refresh();
  return { ok: true };
}

// Task checklists ----------------------------------------------------------------

function failSteps(error: PostgrestError | null): ActionResult {
  if (error?.code === "23514" && error.message.includes("at most 20 checklist items")) return { error: strings.tasks.stepsLimit };
  return fail(error);
}

/** Append one step (or several, one per line) to a task's checklist. Task editors only (RLS). */
export async function addChecklistSteps(
  teamId: number,
  taskId: number,
  _p: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const steps = parseSteps(String(formData.get("text") ?? ""));
  if (steps.length === 0) return { error: strings.common.genericError };
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("task_checklist_items")
    .select("position")
    .eq("team_id", teamId)
    .eq("task_id", taskId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const start = (last?.position ?? 0) + 1;
  const { error } = await supabase
    .from("task_checklist_items")
    .insert(steps.map((s, i) => ({ task_id: taskId, team_id: teamId, text: s, position: start + i })));
  if (error) return failSteps(error);
  refresh();
  return { ok: true };
}

/** Tick or untick a step: task editors, or the assignee of an assigned team task (RLS). */
export async function setChecklistStepDone(teamId: number, itemId: number, done: boolean) {
  return run((db) =>
    db
      .from("task_checklist_items")
      .update({ done }, { count: "exact" })
      .eq("team_id", teamId)
      .eq("id", itemId),
  );
}

/** Tick or untick my own copy of a team-wide task's step (each cadet has their own ticks; RLS). */
export async function setMyChecklistStepDone(teamId: number, memberId: number, itemId: number, done: boolean) {
  return run((db) =>
    done
      ? db.from("task_checklist_ticks").upsert({ item_id: itemId, member_id: memberId, team_id: teamId }, { ignoreDuplicates: true })
      : db.from("task_checklist_ticks").delete().eq("item_id", itemId).eq("member_id", memberId),
  );
}

export async function removeChecklistStep(teamId: number, itemId: number) {
  return run((db) =>
    db.from("task_checklist_items").delete({ count: "exact" }).eq("team_id", teamId).eq("id", itemId),
  );
}

export async function deleteTask(teamId: number, taskId: number) {
  return run((db) => db.from("tasks").delete({ count: "exact" }).eq("team_id", teamId).eq("id", taskId));
}

// Notices ----------------------------------------------------------------------

function noticeFields(formData: FormData) {
  return {
    title: text(formData, "title").slice(0, 80),
    body: text(formData, "body").slice(0, 1000),
    audience: text(formData, "audience") === "command" ? ("command" as const) : ("team" as const),
    expires_on: text(formData, "expires_on") || null,
  };
}

export async function postNotice(teamId: number, _p: ActionResult, formData: FormData): Promise<ActionResult> {
  const fields = noticeFields(formData);
  if (!fields.title) return { error: strings.common.genericError };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { error } = await supabase.from("notices").insert({
    team_id: teamId,
    ...fields,
    pinned: formData.get("pinned") === "on",
    created_by: claims?.claims?.sub,
  });
  if (error) return fail(error);
  refresh();
  return { ok: true, message: strings.notices.posted };
}

export async function updateNotice(teamId: number, noticeId: number, _p: ActionResult, formData: FormData) {
  const fields = noticeFields(formData);
  if (!fields.title) return { error: strings.common.genericError };
  return run((db) =>
    db.from("notices").update(fields, { count: "exact" }).eq("team_id", teamId).eq("id", noticeId),
  );
}

export async function setNoticePinned(teamId: number, noticeId: number, pinned: boolean) {
  return run((db) =>
    db.from("notices").update({ pinned }, { count: "exact" }).eq("team_id", teamId).eq("id", noticeId),
  );
}

export async function removeNotice(teamId: number, noticeId: number) {
  return run((db) => db.from("notices").delete({ count: "exact" }).eq("team_id", teamId).eq("id", noticeId));
}

// Calendar ---------------------------------------------------------------------

export async function addCalendar(teamId: number, _p: ActionResult, formData: FormData): Promise<ActionResult> {
  const ids = parseCalendarIds(String(formData.get("calendar") ?? ""));
  if (ids.length === 0) return { error: strings.calendar.notFound };
  const typedLabel = text(formData, "label").slice(0, 60);
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  let notShared = 0;
  let configured = false;
  for (const id of ids) {
    // Check access first: it tells us whether Roma can read it, and its name for the label.
    const access = await probeCalendar(id);
    if (access.status !== "not-configured") configured = true;
    if (access.status === "not-shared" || access.status === "error") notShared++;
    const label = typedLabel || (access.status === "ok" ? access.name : "");
    const { error } = await supabase
      .from("integrations")
      .insert({ team_id: teamId, kind: "gcal", external_id: id, label, created_by: claims?.claims?.sub });
    if (error?.code === "23505") return { error: strings.calendar.duplicate };
    if (error?.code === "23514") return { error: strings.calendar.tooMany };
    if (error) return fail(error);
  }
  refresh();
  if (!configured) return { ok: true, message: strings.calendar.connectedEmbed };
  if (notShared > 0) return { ok: true, warning: strings.calendar.savedNotShared(calendarAccountEmail() ?? "") };
  return { ok: true, message: strings.calendar.connectedOk };
}

export async function removeIntegration(teamId: number, integrationId: number) {
  return run((db) =>
    db.from("integrations").delete({ count: "exact" }).eq("team_id", teamId).eq("id", integrationId),
  );
}

// Links ----------------------------------------------------------------------

export async function addLink(teamId: number, _p: ActionResult, formData: FormData) {
  const title = text(formData, "title");
  const url = text(formData, "url");
  if (!title) return { error: strings.common.genericError };
  if (!/^https?:\/\//i.test(url)) return { error: strings.links.badUrl };
  return run((db) =>
    db.from("links").insert({ team_id: teamId, title, url, category: text(formData, "category") }),
  );
}

export async function removeLink(teamId: number, linkId: number) {
  return run((db) => db.from("links").delete({ count: "exact" }).eq("team_id", teamId).eq("id", linkId));
}

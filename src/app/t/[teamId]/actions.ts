"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { strings } from "@/lib/strings";
import type { ActionResult } from "@/components/ui";

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
  return run((db) =>
    db.from("role_assignments").insert({
      team_id: teamId,
      role_id: roleId,
      member_id: memberId,
      start_date: start,
      end_date: end,
    }),
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
  const { error } = await supabase.from("tasks").insert({
    team_id: teamId,
    visibility,
    title: title.slice(0, 120),
    notes: text(formData, "notes").slice(0, 500),
    due_on: dueOn,
    due_time: dueTime,
    assignee_member_id: assignee,
    created_by: claims?.claims?.sub,
  });
  if (error) return fail(error);
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

export async function deleteTask(teamId: number, taskId: number) {
  return run((db) => db.from("tasks").delete({ count: "exact" }).eq("team_id", teamId).eq("id", taskId));
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

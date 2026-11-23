import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { asLayout } from "@/lib/tasks";

type Tables = Database["public"]["Tables"];
export type Team = Tables["teams"]["Row"];
export type Member = Tables["team_members"]["Row"];
export type Role = Tables["team_roles"]["Row"];
export type Assignment = Tables["role_assignments"]["Row"];
export type Session = Tables["attendance_sessions"]["Row"];
export type Entry = Tables["attendance_entries"]["Row"];
export type LinkRow = Tables["links"]["Row"];
export type Integration = Tables["integrations"]["Row"];
export type Notice = Tables["notices"]["Row"];
export type ChecklistItem = Pick<Tables["task_checklist_items"]["Row"], "id" | "text" | "position" | "done">;
export type Task = Tables["tasks"]["Row"] & {
  task_completions: { member_id: number }[];
  task_checklist_items: ChecklistItem[];
};
export type AttendanceStatus = "present" | "late" | "absent";

export type Permissions = {
  is_member: boolean;
  is_admin: boolean;
  can_command: boolean;
  can_manage: boolean;
  today: string;
};

export type DutyRow = {
  assignmentId: number;
  role: Role;
  member: Member;
  startDate: string;
  endDate: string;
};

export function fullName(m: Pick<Member, "first_name" | "last_name">) {
  return [m.first_name, m.last_name].filter(Boolean).join(" ");
}

export const getMyTeams = cache(async () => {
  const userId = await getUserId();
  if (!userId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_members")
    .select("team_id, teams(id, name)")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? [])
    .map((row) => row.teams)
    .filter((t): t is { id: number; name: string } => Boolean(t));
});

/** Everything the team shell needs, fetched once per request. */
export const getTeamContext = cache(async (teamId: number) => {
  const userId = await getUserId();
  if (!userId || !Number.isFinite(teamId)) notFound();
  const supabase = await createClient();

  const [team, perms, members, roles, assignments] = await Promise.all([
    supabase.from("teams").select("*").eq("id", teamId).maybeSingle(),
    supabase.rpc("my_permissions", { p_team_id: teamId }),
    supabase.from("team_members").select("*").eq("team_id", teamId).order("sort_order").order("first_name"),
    supabase.from("team_roles").select("*").eq("team_id", teamId).order("sort_order").order("name"),
    supabase.from("role_assignments").select("*").eq("team_id", teamId).order("start_date"),
  ]);

  if (team.error) throw team.error;
  if (!team.data) notFound();
  for (const r of [perms, members, roles, assignments]) if (r.error) throw r.error;

  const permissions = perms.data as unknown as Permissions;
  const today = permissions.today;
  const roster = members.data ?? [];
  const roleList = roles.data ?? [];
  const byMember = new Map(roster.map((m) => [m.id, m]));
  const byRole = new Map(roleList.map((r) => [r.id, r]));

  const toDuty = (a: Assignment): DutyRow | null => {
    const role = byRole.get(a.role_id);
    const member = byMember.get(a.member_id);
    return role && member
      ? { assignmentId: a.id, role, member, startDate: a.start_date, endDate: a.end_date }
      : null;
  };
  const allDuty = (assignments.data ?? []).map(toDuty).filter((d): d is DutyRow => d !== null);
  const roleOrder = (d: DutyRow) => d.role.sort_order;
  const onDuty = allDuty
    .filter((d) => d.startDate <= today && today <= d.endDate)
    .sort((a, b) => roleOrder(a) - roleOrder(b));
  const upcoming = allDuty.filter((d) => d.startDate > today);
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const nextUp = allDuty
    .filter((d) => d.startDate === tomorrow)
    .sort((a, b) => roleOrder(a) - roleOrder(b));

  return {
    team: team.data,
    permissions,
    today,
    me: roster.find((m) => m.user_id === userId) ?? null,
    roster,
    roles: roleList,
    onDuty,
    upcoming,
    nextUp,
  };
});

export async function getSessions(teamId: number, limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select("*, attendance_entries(member_id, status, reason)")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getSession(teamId: number, sessionId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select("*, attendance_entries(*)")
    .eq("team_id", teamId)
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Open tasks plus the last week's done ones the viewer may see (RLS filters private tasks). */
export async function getTasks(teamId: number) {
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("tasks")
    .select("*, task_completions(member_id), task_checklist_items(id, text, position, done, task_checklist_ticks(member_id))")
    .eq("team_id", teamId)
    .or(`status.eq.open,done_at.gte.${weekAgo}`)
    .order("due_on", { ascending: true, nullsFirst: false })
    .limit(300);
  if (error) throw error;
  // A team-wide task's steps are ticked per cadet: "done" is my own tick (RLS returns only mine).
  return (data ?? []).map((t) => ({
    ...t,
    task_checklist_items: t.task_checklist_items.map(({ task_checklist_ticks: ticks, ...step }) => ({
      ...step,
      done: t.visibility === "team" && t.assignee_member_id === null ? ticks.length > 0 : step.done,
    })),
  }));
}

/** My board placements (lane + order) for this team's tasks. Private to me by RLS. */
export async function getTaskLanes(teamId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("task_lanes").select("task_id, lane, position").eq("team_id", teamId);
  if (error) throw error;
  return data ?? [];
}

/** My chosen task layout ("list" when I never picked one). */
export async function getTaskLayout() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_settings").select("task_layout").maybeSingle();
  if (error) throw error;
  return asLayout(data?.task_layout);
}

/** Notices still on the board (not past their expiry date); RLS hides handover notes from non-role-holders. */
export async function getNotices(teamId: number, today: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notices")
    .select("*")
    .eq("team_id", teamId)
    .or(`expires_on.is.null,expires_on.gte.${today}`)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function getCalendars(teamId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("team_id", teamId)
    .eq("kind", "gcal")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function getLinks(teamId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("links")
    .select("*")
    .eq("team_id", teamId)
    .order("category")
    .order("sort_order")
    .order("title");
  if (error) throw error;
  return data ?? [];
}

import "server-only";
import { isoDate, shortDate, weekdayOf } from "./dates";
import { createAdminClient } from "./supabase/admin";
import { pushToUsers } from "./push";
import { strings } from "./strings";

const n = strings.notifications;

/** Who holds a command role in this team today (their user ids). */
async function todaysRoleHolders(teamId: number) {
  const admin = createAdminClient();
  if (!admin) return [];
  const today = isoDate();
  const { data } = await admin
    .from("role_assignments")
    .select("team_roles!inner(is_command), team_members!inner(user_id)")
    .eq("team_id", teamId)
    .lte("start_date", today)
    .gte("end_date", today);
  return (data ?? [])
    .filter((r) => r.team_roles?.is_command)
    .map((r) => r.team_members?.user_id)
    .filter((u): u is string => Boolean(u));
}

/** "You've been assigned א׳ צוות, ה׳ 20.11–ו׳ 21.11": to the assigned cadet's devices. */
export async function notifyAssignment(teamId: number, memberId: number, roleId: number, start: string, end: string) {
  const admin = createAdminClient();
  if (!admin) return;
  const [{ data: member }, { data: role }] = await Promise.all([
    admin.from("team_members").select("user_id").eq("id", memberId).eq("team_id", teamId).maybeSingle(),
    admin.from("team_roles").select("name").eq("id", roleId).eq("team_id", teamId).maybeSingle(),
  ]);
  if (!member?.user_id || !role) return;
  const range = start === end ? `${weekdayOf(start)} ${shortDate(start)}` : `${weekdayOf(start)} ${shortDate(start)}–${weekdayOf(end)} ${shortDate(end)}`;
  await pushToUsers([member.user_id], {
    title: n.assignedTitle(role.name),
    body: range,
    url: `/t/${teamId}`,
    tag: `assignment-${teamId}`,
  });
}

/** New team task: to today's role-holders and the assignee, never to whoever created it. */
export async function notifyTeamTask(teamId: number, title: string, assigneeMemberId: number | null, creatorId: string | null) {
  const admin = createAdminClient();
  if (!admin) return;
  const recipients = await todaysRoleHolders(teamId);
  if (assigneeMemberId) {
    const { data } = await admin.from("team_members").select("user_id").eq("id", assigneeMemberId).maybeSingle();
    if (data?.user_id) recipients.push(data.user_id);
  }
  await pushToUsers(
    recipients.filter((u) => u !== creatorId),
    { title: assigneeMemberId ? n.assignedTaskTitle : n.teamTaskTitle, body: title, url: `/t/${teamId}/tasks`, tag: `task-${teamId}` },
  );
}

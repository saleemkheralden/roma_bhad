import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushToUsers } from "@/lib/push";
import { composeSummary } from "@/lib/evening-summary";
import { isoDate } from "@/lib/dates";
import { addDays } from "@/lib/tasks";

// Evening summary for everyone with notifications on. Runs daily from Vercel Cron
// (vercel.json), authorised with CRON_SECRET. `?dry=1` returns the messages without sending.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = request.nextUrl.searchParams.get("dry") === "1";
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const today = isoDate();
  const tomorrow = addDays(today, 1);

  // Only people who turned notifications on.
  const { data: subs } = await admin.from("push_subscriptions").select("user_id");
  const userIds = [...new Set((subs ?? []).map((s) => s.user_id))];
  if (userIds.length === 0) return NextResponse.json({ sent: 0, messages: 0 });

  const { data: memberships } = await admin
    .from("team_members")
    .select("id, team_id, user_id, teams!inner(name)")
    .in("user_id", userIds);
  const teamIds = [...new Set((memberships ?? []).map((m) => m.team_id))];
  if (teamIds.length === 0) return NextResponse.json({ sent: 0, messages: 0 });

  const [{ data: tasks }, { data: completions }, { data: assignments }] = await Promise.all([
    admin
      .from("tasks")
      .select("id, team_id, visibility, owner_id, assignee_member_id, status, due_on, created_at")
      .in("team_id", teamIds)
      // Wide created_at window (Israel's day starts ~21:00-22:00 UTC the day before); exact day filtered below.
      .or(`due_on.eq.${tomorrow},created_at.gte.${addDays(today, -1)}T20:00:00Z`),
    admin.from("task_completions").select("task_id, member_id").in("team_id", teamIds),
    admin
      .from("role_assignments")
      .select("team_id, member_id, team_roles!inner(name, is_command, sort_order), team_members!inner(first_name, last_name)")
      .in("team_id", teamIds)
      .lte("start_date", tomorrow)
      .gte("end_date", tomorrow),
  ]);

  const done = new Set((completions ?? []).map((c) => `${c.task_id}:${c.member_id}`));
  const messages: { userId: string; teamId: number; title: string; body: string }[] = [];

  for (const m of memberships ?? []) {
    if (!m.user_id) continue;
    const teamTasks = (tasks ?? []).filter((t) => t.team_id === m.team_id);
    const dueTomorrow = teamTasks.filter(
      (t) =>
        t.status === "open" &&
        t.due_on === tomorrow &&
        ((t.visibility === "private" && t.owner_id === m.user_id) ||
          (t.visibility === "team" && t.assignee_member_id === m.id) ||
          (t.visibility === "team" && t.assignee_member_id === null && !done.has(`${t.id}:${m.id}`))),
    ).length;
    const newTeamTasksToday = teamTasks.filter(
      (t) => t.visibility === "team" && isoDate(new Date(t.created_at)) === today,
    ).length;
    const tomorrowRoles = (assignments ?? [])
      .filter((a) => a.team_id === m.team_id && a.team_roles?.is_command)
      .sort((a, b) => (a.team_roles?.sort_order ?? 0) - (b.team_roles?.sort_order ?? 0))
      .map((a) => ({
        role: a.team_roles?.name ?? "",
        name: [a.team_members?.first_name, a.team_members?.last_name].filter(Boolean).join(" "),
        isMe: a.member_id === m.id,
      }));
    const msg = composeSummary({ teamName: m.teams?.name ?? "", dueTomorrow, newTeamTasksToday, tomorrowRoles });
    if (msg) messages.push({ userId: m.user_id, teamId: m.team_id, ...msg });
  }

  if (dry) return NextResponse.json({ messages });

  let sent = 0;
  for (const msg of messages) {
    const r = await pushToUsers([msg.userId], {
      title: msg.title,
      body: msg.body,
      url: `/t/${msg.teamId}`,
      tag: `evening-${msg.teamId}`,
    });
    sent += r.sent;
  }
  return NextResponse.json({ messages: messages.length, sent });
}

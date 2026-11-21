import { NextResponse, type NextRequest } from "next/server";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { Permissions } from "@/lib/data";

// End-of-course data export (see CLAUDE.md: keep "export my data" possible).
//   ?scope=me   → anything a member can download about themselves in this team
//   ?scope=team → the whole team's shared data; admins only
// RLS still decides every row; this only shapes the file. Account ids (auth uuids) are left out.

type Db = Awaited<ReturnType<typeof createClient>>;

async function rows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function exportMe(db: Db, teamId: number, userId: string) {
  const me = await rows(
    db.from("team_members").select("id, first_name, last_name, nickname, is_admin, is_staff, created_at").eq("team_id", teamId).eq("user_id", userId),
  );
  const memberId = me[0]?.id ?? -1;
  const [privateTasks, completions, lanes, settings] = await Promise.all([
    rows(
      db
        .from("tasks")
        .select("id, title, notes, due_on, due_time, status, created_at, done_at, task_checklist_items(text, position, done)")
        .eq("team_id", teamId)
        .eq("visibility", "private")
        .eq("owner_id", userId),
    ),
    rows(db.from("task_completions").select("task_id, done_at").eq("team_id", teamId).eq("member_id", memberId)),
    rows(db.from("task_lanes").select("task_id, lane, position").eq("team_id", teamId)),
    rows(db.from("user_settings").select("task_layout")),
  ]);
  return { roster_entry: me[0] ?? null, private_tasks: privateTasks, my_task_completions: completions, my_board: lanes, my_settings: settings[0] ?? null };
}

async function exportTeam(db: Db, teamId: number) {
  const [team, members, roles, assignments, sessions, links, tasks, integrations] = await Promise.all([
    rows(db.from("teams").select("id, name, created_at").eq("id", teamId)),
    rows(db.from("team_members").select("id, first_name, last_name, nickname, is_admin, is_staff, user_id, created_at").eq("team_id", teamId)),
    rows(db.from("team_roles").select("id, name, is_command, sort_order").eq("team_id", teamId)),
    rows(db.from("role_assignments").select("role_id, member_id, start_date, end_date").eq("team_id", teamId)),
    rows(
      db
        .from("attendance_sessions")
        .select("id, label, created_at, attendance_entries(member_id, status, reason)")
        .eq("team_id", teamId)
        .order("created_at"),
    ),
    rows(db.from("links").select("title, url, category").eq("team_id", teamId)),
    rows(
      db
        .from("tasks")
        .select(
          "id, title, notes, due_on, due_time, status, assignee_member_id, created_at, done_at, task_completions(member_id, done_at), task_checklist_items(text, position, done)",
        )
        .eq("team_id", teamId)
        .eq("visibility", "team"),
    ),
    rows(db.from("integrations").select("kind, external_id, label").eq("team_id", teamId)),
  ]);
  return {
    team: team[0] ?? null,
    // Whether a name was claimed by an account, without the account id itself.
    roster: members.map(({ user_id, ...m }) => ({ ...m, joined: Boolean(user_id) })),
    roles,
    role_assignments: assignments,
    roll_calls: sessions,
    links,
    team_tasks: tasks,
    integrations,
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const teamId = Number((await params).teamId);
  const scope = request.nextUrl.searchParams.get("scope") === "team" ? "team" : "me";
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "signed out" }, { status: 401 });

  const db = await createClient();
  const { data: perms, error } = await db.rpc("my_permissions", { p_team_id: teamId });
  const p = perms as unknown as Permissions | null;
  if (error || !p?.is_member) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (scope === "team" && !p.is_admin) return NextResponse.json({ error: "admins only" }, { status: 403 });

  const data = scope === "team" ? await exportTeam(db, teamId) : await exportMe(db, teamId, userId);
  const body = JSON.stringify({ exported_at: new Date().toISOString(), scope, team_id: teamId, ...data }, null, 2);
  const file = `roma-${scope === "team" ? "team" : "my-data"}-${teamId}-${p.today}.json`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "no-store",
    },
  });
}

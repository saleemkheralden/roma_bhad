import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { isoDate } from "@/lib/dates";

type Tables = Database["public"]["Tables"];
export type Battalion = Tables["battalions"]["Row"];
export type BattalionMember = Tables["battalion_members"]["Row"];
export type BattalionRole = Tables["battalion_roles"]["Row"];
export type BattalionAssignment = Tables["battalion_role_assignments"]["Row"];

/** A cadet of the battalion (battalion_people(): all of them for managers, else only role-holders). */
export type BattalionPerson = { team_member_id: number; name: string; team_name: string; company_name: string; is_me: boolean };

/** Who holds a battalion role: battalion staff, or a cadet (detail = team · company). */
export type BattalionAssignee = { name: string; detail: string | null; isMe: boolean };

/** One company on the battalion dashboard: counts only, never names (see the migration). */
export type DashboardCompany = {
  company_id: number;
  company_name: string;
  teams: number;
  roster: number;
  reported_teams: number;
  present: number;
  late: number;
  absent: number;
  open_tasks: number;
  overdue_tasks: number;
};

/** Battalions I see: as staff, or because I hold a battalion role today or later (RLS decides). */
export const getMyBattalions = cache(async () => {
  const userId = await getUserId();
  if (!userId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("battalions").select("id, name");
  if (error) throw error;
  return data ?? [];
});

export const getBattalionContext = cache(async (battalionId: number) => {
  const userId = await getUserId();
  if (!userId || !Number.isFinite(battalionId)) notFound();
  const supabase = await createClient();
  const [battalion, members, roles, assignments, peopleRes] = await Promise.all([
    supabase.from("battalions").select("*").eq("id", battalionId).maybeSingle(),
    supabase.from("battalion_members").select("*").eq("battalion_id", battalionId).order("display_name"),
    supabase.from("battalion_roles").select("*").eq("battalion_id", battalionId).order("sort_order").order("name"),
    supabase.from("battalion_role_assignments").select("*").eq("battalion_id", battalionId).order("start_date"),
    supabase.rpc("battalion_people", { p_battalion_id: battalionId }),
  ]);
  if (battalion.error) throw battalion.error;
  if (!battalion.data) notFound();
  const people = (peopleRes.data as unknown as BattalionPerson[] | null) ?? [];
  const todayIso = isoDate(); // Israel time, same as private.today()
  const memberList = members.data ?? [];
  const roleList = roles.data ?? [];
  const me = memberList.find((m) => m.user_id === userId) ?? null;
  const byMember = new Map(memberList.map((m) => [m.id, m]));
  const byPerson = new Map(people.map((p) => [p.team_member_id, p]));
  const byRole = new Map(roleList.map((r) => [r.id, r]));
  const assigneeOf = (a: BattalionAssignment): BattalionAssignee | null => {
    if (a.member_id) {
      const m = byMember.get(a.member_id);
      return m ? { name: m.display_name, detail: null, isMe: m.user_id === userId } : null;
    }
    const p = a.team_member_id ? byPerson.get(a.team_member_id) : undefined;
    return p ? { name: p.name, detail: `${p.team_name} · ${p.company_name}`, isMe: p.is_me } : null;
  };
  const rows = (assignments.data ?? [])
    .map((a) => ({ a, role: byRole.get(a.role_id), member: assigneeOf(a) }))
    .filter((x): x is { a: BattalionAssignment; role: BattalionRole; member: BattalionAssignee } => Boolean(x.role && x.member));
  const onDuty = rows.filter((x) => x.a.start_date <= todayIso && todayIso <= x.a.end_date);
  const upcoming = rows.filter((x) => x.a.start_date > todayIso);
  const isAdmin = Boolean(me?.is_admin);
  const canManage = isAdmin || onDuty.some((x) => x.member.isMe && x.role.is_command);
  return { battalion: battalion.data, me, members: memberList, people, roles: roleList, onDuty, upcoming, today: todayIso, isAdmin, canManage };
});

export async function getBattalionDashboard(battalionId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("battalion_dashboard", { p_battalion_id: battalionId });
  if (error) throw error;
  return (data as unknown as DashboardCompany[]) ?? [];
}

/** Companies of the battalion with their team names (admins only; unit names, no people). */
export type StructureCompany = { company_id: number; company_name: string; teams: { team_id: number; team_name: string }[] };

export async function getBattalionStructure(battalionId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("battalion_structure", { p_battalion_id: battalionId });
  if (error) throw error;
  return (data as unknown as StructureCompany[]) ?? [];
}

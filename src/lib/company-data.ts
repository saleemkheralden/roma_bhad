import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { isoDate } from "@/lib/dates";

type Tables = Database["public"]["Tables"];
export type Company = Tables["companies"]["Row"];
export type CompanyMember = Tables["company_members"]["Row"];
export type CompanyRole = Tables["company_roles"]["Row"];
export type CompanyAssignment = Tables["company_role_assignments"]["Row"];

export type DashboardTeam = {
  team_id: number;
  team_name: string;
  roster: number;
  roles_today: { role: string; name: string }[];
  roll_call: {
    label: string;
    at: string;
    present: number;
    exceptions: { name: string; status: "late" | "absent"; reason: string | null }[];
  } | null;
  open_tasks: number;
  overdue_tasks: number;
};

/** A cadet on one of the company's teams (company_people()). */
export type CompanyPerson = { team_member_id: number; name: string; team_id: number; team_name: string; joined: boolean; is_me: boolean };

/** Who holds a company role: company staff, or a cadet from one of its teams. */
export type Assignee = { name: string; detail: string | null; isMe: boolean };

/** Companies I see: as staff, or because I hold a company role today or later (RLS decides). */
export const getMyCompanies = cache(async () => {
  const userId = await getUserId();
  if (!userId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("companies").select("id, name");
  if (error) throw error;
  return data ?? [];
});

/** Company shell data: the company, my row, members, roles, assignments, and what I may do. */
export const getCompanyContext = cache(async (companyId: number) => {
  const userId = await getUserId();
  if (!userId || !Number.isFinite(companyId)) notFound();
  const supabase = await createClient();
  const [company, members, roles, assignments, peopleRes] = await Promise.all([
    supabase.from("companies").select("*").eq("id", companyId).maybeSingle(),
    supabase.from("company_members").select("*").eq("company_id", companyId).order("display_name"),
    supabase.from("company_roles").select("*").eq("company_id", companyId).order("sort_order").order("name"),
    supabase.from("company_role_assignments").select("*").eq("company_id", companyId).order("start_date"),
    supabase.rpc("company_people", { p_company_id: companyId }),
  ]);
  if (company.error) throw company.error;
  if (!company.data) notFound();
  const people = ((peopleRes.data as unknown as CompanyPerson[] | null) ?? []);
  const todayIso = isoDate(); // Israel time, same as private.today()
  const memberList = members.data ?? [];
  const roleList = roles.data ?? [];
  const me = memberList.find((m) => m.user_id === userId) ?? null;
  const byMember = new Map(memberList.map((m) => [m.id, m]));
  const byPerson = new Map(people.map((p) => [p.team_member_id, p]));
  const byRole = new Map(roleList.map((r) => [r.id, r]));
  const assigneeOf = (a: CompanyAssignment): Assignee | null => {
    if (a.member_id) {
      const m = byMember.get(a.member_id);
      return m ? { name: m.display_name, detail: null, isMe: m.user_id === userId } : null;
    }
    const p = a.team_member_id ? byPerson.get(a.team_member_id) : undefined;
    return p ? { name: p.name, detail: p.team_name, isMe: p.is_me } : null;
  };
  const rows = (assignments.data ?? [])
    .map((a) => ({ a, role: byRole.get(a.role_id), member: assigneeOf(a) }))
    .filter((x): x is { a: CompanyAssignment; role: CompanyRole; member: Assignee } => Boolean(x.role && x.member));
  const onDuty = rows.filter((x) => x.a.start_date <= todayIso && todayIso <= x.a.end_date);
  const upcoming = rows.filter((x) => x.a.start_date > todayIso);
  const isAdmin = Boolean(me?.is_admin);
  const canManage = isAdmin || onDuty.some((x) => x.member.isMe && x.role.is_command);
  return { company: company.data, me, members: memberList, people, roles: roleList, onDuty, upcoming, today: todayIso, isAdmin, canManage };
});

export async function getCompanyDashboard(companyId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("company_dashboard", { p_company_id: companyId });
  if (error) throw error;
  return (data as unknown as DashboardTeam[]) ?? [];
}

/** The team's company, when the viewer is a member of it (otherwise RLS hides it). */
export async function getTeamCompany(companyId: number | null) {
  if (!companyId) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("id, name").eq("id", companyId).maybeSingle();
  return data;
}

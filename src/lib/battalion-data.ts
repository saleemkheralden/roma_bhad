import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];
export type Battalion = Tables["battalions"]["Row"];
export type BattalionMember = Tables["battalion_members"]["Row"];

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

export const getMyBattalions = cache(async () => {
  const userId = await getUserId();
  if (!userId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("battalion_members").select("battalion_id, battalions(id, name)").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.battalions).filter((b): b is { id: number; name: string } => Boolean(b));
});

export const getBattalionContext = cache(async (battalionId: number) => {
  const userId = await getUserId();
  if (!userId || !Number.isFinite(battalionId)) notFound();
  const supabase = await createClient();
  const [battalion, members] = await Promise.all([
    supabase.from("battalions").select("*").eq("id", battalionId).maybeSingle(),
    supabase.from("battalion_members").select("*").eq("battalion_id", battalionId).order("display_name"),
  ]);
  if (battalion.error) throw battalion.error;
  if (!battalion.data) notFound();
  const memberList = members.data ?? [];
  const me = memberList.find((m) => m.user_id === userId) ?? null;
  return { battalion: battalion.data, me, members: memberList, isAdmin: Boolean(me?.is_admin) };
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

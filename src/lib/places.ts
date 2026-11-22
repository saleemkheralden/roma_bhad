import "server-only";
import { cookies } from "next/headers";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getMyTeams } from "@/lib/data";
import { getMyCompanies } from "@/lib/company-data";
import { getMyBattalions } from "@/lib/battalion-data";

// Every unit the signed-in user belongs to, for the header switcher and the home redirect.

export type PlaceKind = "team" | "company" | "battalion";
export type Place = { kind: PlaceKind; id: number; name: string };

export async function getMyPlaces(): Promise<Place[]> {
  const [teams, companies, battalions] = await Promise.all([getMyTeams(), getMyCompanies(), getMyBattalions()]);
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "he");
  return [
    ...[...teams].sort(byName).map((t) => ({ kind: "team" as const, id: t.id, name: t.name })),
    ...[...companies].sort(byName).map((c) => ({ kind: "company" as const, id: c.id, name: c.name })),
    ...[...battalions].sort(byName).map((b) => ({ kind: "battalion" as const, id: b.id, name: b.name })),
  ];
}

/** Where "/" should go: the last place opened, if the user still belongs to it; else the first team, then company. */
export async function homeFor(places: Place[]): Promise<string | null> {
  const last = (await cookies()).get("roma_last")?.value ?? "";
  const m = last.match(/^\/(t|c|b)\/(\d+)$/);
  if (m) {
    const kind: PlaceKind = m[1] === "t" ? "team" : m[1] === "c" ? "company" : "battalion";
    if (places.some((p) => p.kind === kind && p.id === Number(m[2]))) return last;
  }
  const first = places.find((p) => p.kind === "team") ?? places[0];
  if (!first) return null;
  return `/${first.kind === "team" ? "t" : first.kind === "company" ? "c" : "b"}/${first.id}`;
}

/** Teams I admin (to add to a company with one tap) and companies I admin (to add to a battalion). */
export type AdminUnits = {
  teams: { id: number; name: string; company_id: number | null }[];
  companies: { id: number; name: string; battalion_id: number | null }[];
};

export async function getMyAdminUnits(): Promise<AdminUnits> {
  const userId = await getUserId();
  if (!userId) return { teams: [], companies: [] };
  const supabase = await createClient();
  const [teams, companies] = await Promise.all([
    supabase.from("team_members").select("teams(id, name, company_id)").eq("user_id", userId).eq("is_admin", true),
    supabase.from("company_members").select("companies(id, name, battalion_id)").eq("user_id", userId).eq("is_admin", true),
  ]);
  return {
    teams: (teams.data ?? []).map((r) => r.teams).filter((x): x is { id: number; name: string; company_id: number | null } => Boolean(x)),
    companies: (companies.data ?? [])
      .map((r) => r.companies)
      .filter((x): x is { id: number; name: string; battalion_id: number | null } => Boolean(x)),
  };
}

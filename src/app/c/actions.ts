"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { strings } from "@/lib/strings";
import type { ActionResult } from "@/components/ui";

// Company-level actions. RLS, triggers and the private RPC bodies decide who may do what.

const c = strings.company;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(error: PostgrestError | null): ActionResult {
  if (error?.code === "42501") return { error: strings.common.noPermission };
  if (error?.code === "P0002") return { error: c.badCode };
  if (error?.code === "23514" && error.message.includes("admin")) return { error: c.lastAdmin };
  return { error: strings.common.genericError };
}

async function run(
  write: (db: Awaited<ReturnType<typeof createClient>>) => PromiseLike<{ error: PostgrestError | null; count?: number | null }>,
): Promise<ActionResult> {
  const db = await createClient();
  const { error, count } = await write(db);
  if (error) return fail(error);
  if (count === 0) return { error: strings.common.noPermission };
  refresh();
  return { ok: true };
}

/** Create a company (from /new). The creator becomes its admin; teams are added from the company page. */
export async function createCompany(_p: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = text(formData, "name");
  const displayName = text(formData, "display_name");
  if (!name || !displayName) return { error: strings.common.genericError };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_company", { p_name: name, p_display_name: displayName });
  if (error || !data) return fail(error);
  redirect(`/c/${data}`);
}

/** Company admins add a team with the team's own code (top-down; cadets never deal with companies). */
export async function addTeamToCompany(companyId: number, _p: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("company_add_team", { p_company_id: companyId, p_team_code: text(formData, "code") });
  if (error?.code === "P0002") return { error: c.badTeamCode };
  if (error?.code === "23505") return { error: c.teamTaken };
  if (error) return fail(error);
  refresh();
  return { ok: true, message: c.teamAdded((data as { team_name?: string } | null)?.team_name ?? "") };
}

/** One tap: a team I admin goes into a company I admin. */
export async function addMyTeamToCompany(companyId: number, teamId: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("company_add_my_team", { p_company_id: companyId, p_team_id: teamId });
  if (error?.code === "23505") return { error: c.teamTaken };
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

/** Open a new team directly inside the company (the company admin becomes its admin). */
export async function createTeamInCompany(companyId: number, _p: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = text(formData, "name");
  const first = text(formData, "first_name");
  if (!name || !first) return { error: strings.common.genericError };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_team_in_company", {
    p_company_id: companyId,
    p_name: name,
    p_first_name: first,
    p_last_name: text(formData, "last_name"),
  });
  if (error) return fail(error);
  refresh();
  return { ok: true, message: c.teamCreated(name) };
}

export async function removeTeamFromCompany(companyId: number, teamId: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("company_remove_team", { p_company_id: companyId, p_team_id: teamId });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

/** A team admin detaches the team (e.g. it was added to the wrong company). */
export async function unlinkTeam(teamId: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("link_team_to_company", { p_team_id: teamId, p_code: null as unknown as string });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function joinCompany(_p: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_company", {
    p_code: text(formData, "code"),
    p_display_name: text(formData, "display_name"),
  });
  if (error || !data) return fail(error);
  redirect(`/c/${data}`);
}

export async function regenerateCompanyCode(companyId: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_company_code", { p_company_id: companyId });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function setCompanyAdmin(companyId: number, memberId: number, value: boolean) {
  return run((db) =>
    db.from("company_members").update({ is_admin: value }, { count: "exact" }).eq("company_id", companyId).eq("id", memberId),
  );
}

export async function removeCompanyMember(companyId: number, memberId: number) {
  return run((db) => db.from("company_members").delete({ count: "exact" }).eq("company_id", companyId).eq("id", memberId));
}

export async function addCompanyRole(companyId: number, _p: ActionResult, formData: FormData) {
  const name = text(formData, "name");
  if (!name) return { error: strings.common.genericError };
  return run((db) => db.from("company_roles").insert({ company_id: companyId, name, sort_order: 100 }));
}

export async function removeCompanyRole(companyId: number, roleId: number) {
  return run((db) => db.from("company_roles").delete({ count: "exact" }).eq("company_id", companyId).eq("id", roleId));
}

export async function addCompanyAssignment(companyId: number, _p: ActionResult, formData: FormData) {
  const roleId = Number(text(formData, "role_id"));
  // "m:<id>" = company staff, "t:<id>" = a cadet of one of the company's teams.
  const [kind, rawId] = text(formData, "person").split(":");
  const personId = Number(rawId);
  const start = text(formData, "start_date");
  const end = text(formData, "end_date") || start;
  if (!roleId || !personId || (kind !== "m" && kind !== "t") || !start || end < start) return { error: strings.common.genericError };
  return run((db) =>
    db.from("company_role_assignments").insert({
      company_id: companyId,
      role_id: roleId,
      member_id: kind === "m" ? personId : null,
      team_member_id: kind === "t" ? personId : null,
      start_date: start,
      end_date: end,
    }),
  );
}

export async function updateCompanyRole(companyId: number, roleId: number, _p: ActionResult, formData: FormData) {
  const name = text(formData, "name");
  if (!name) return { error: strings.common.genericError };
  return run((db) =>
    db
      .from("company_roles")
      .update({ name, is_command: formData.get("is_command") === "on" }, { count: "exact" })
      .eq("company_id", companyId)
      .eq("id", roleId),
  );
}

export async function updateCompanyAssignment(companyId: number, assignmentId: number, _p: ActionResult, formData: FormData) {
  const roleId = Number(text(formData, "role_id"));
  // "m:<id>" = staff, "t:<id>" = a cadet of one of the unit's teams.
  const [kind, rawId] = text(formData, "person").split(":");
  const personId = Number(rawId);
  const start = text(formData, "start_date");
  const end = text(formData, "end_date") || start;
  if (!roleId || !personId || (kind !== "m" && kind !== "t") || !start) return { error: strings.common.genericError };
  if (end < start) return { error: strings.roleEditing.badDates };
  return run((db) =>
    db
      .from("company_role_assignments")
      .update(
        {
          role_id: roleId,
          member_id: kind === "m" ? personId : null,
          team_member_id: kind === "t" ? personId : null,
          start_date: start,
          end_date: end,
        },
        { count: "exact" },
      )
      .eq("company_id", companyId)
      .eq("id", assignmentId),
  );
}

export async function removeCompanyAssignment(companyId: number, assignmentId: number) {
  return run((db) =>
    db.from("company_role_assignments").delete({ count: "exact" }).eq("company_id", companyId).eq("id", assignmentId),
  );
}

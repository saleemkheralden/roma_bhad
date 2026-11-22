"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { strings } from "@/lib/strings";
import type { ActionResult } from "@/components/ui";

// Battalion-level actions. RLS, triggers and the private RPC bodies decide who may do what.

const b = strings.battalion;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(error: PostgrestError | null): ActionResult {
  if (error?.code === "42501") return { error: strings.common.noPermission };
  if (error?.code === "P0002") return { error: b.badCode };
  if (error?.code === "23514" && error.message.includes("admin")) return { error: b.lastAdmin };
  return { error: strings.common.genericError };
}

export async function createBattalion(_p: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = text(formData, "name");
  const displayName = text(formData, "display_name");
  if (!name || !displayName) return { error: strings.common.genericError };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_battalion", { p_name: name, p_display_name: displayName });
  if (error || !data) return fail(error);
  redirect(`/b/${data}`);
}

export async function joinBattalion(_p: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_battalion", {
    p_code: text(formData, "code"),
    p_display_name: text(formData, "display_name"),
  });
  if (error || !data) return fail(error);
  redirect(`/b/${data}`);
}

/** Battalion admins add a company with the company's staff code (top-down). */
export async function addCompanyToBattalion(battalionId: number, _p: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("battalion_add_company", {
    p_battalion_id: battalionId,
    p_company_code: text(formData, "code"),
  });
  if (error?.code === "P0002") return { error: b.badCompanyCode };
  if (error?.code === "23505") return { error: b.companyTaken };
  if (error) return fail(error);
  refresh();
  return { ok: true, message: b.companyAdded((data as { company_name?: string } | null)?.company_name ?? "") };
}

export async function removeCompanyFromBattalion(battalionId: number, companyId: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("battalion_remove_company", { p_battalion_id: battalionId, p_company_id: companyId });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

/** From the company page: a company admin detaches the company (added by mistake). */
export async function leaveBattalion(companyId: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("company_leave_battalion", { p_company_id: companyId });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function regenerateBattalionCode(battalionId: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_battalion_code", { p_battalion_id: battalionId });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function setBattalionAdmin(battalionId: number, memberId: number, value: boolean) {
  const db = await createClient();
  const { error, count } = await db
    .from("battalion_members")
    .update({ is_admin: value }, { count: "exact" })
    .eq("battalion_id", battalionId)
    .eq("id", memberId);
  if (error) return fail(error);
  if (count === 0) return { error: strings.common.noPermission };
  refresh();
  return { ok: true };
}

export async function removeBattalionMember(battalionId: number, memberId: number) {
  const db = await createClient();
  const { error, count } = await db
    .from("battalion_members")
    .delete({ count: "exact" })
    .eq("battalion_id", battalionId)
    .eq("id", memberId);
  if (error) return fail(error);
  if (count === 0) return { error: strings.common.noPermission };
  refresh();
  return { ok: true };
}

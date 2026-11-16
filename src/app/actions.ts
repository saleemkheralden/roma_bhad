"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { strings } from "@/lib/strings";
import type { ActionResult } from "@/components/ui";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createTeam(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = text(formData, "name");
  const first = text(formData, "first_name");
  const last = text(formData, "last_name");
  if (!name || !first) return { error: strings.common.genericError };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_team", {
    p_name: name,
    p_first_name: first,
    p_last_name: last,
  });
  if (error || !data) return { error: strings.common.genericError };
  redirect(`/t/${data}/team`);
}

export async function joinTeam(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const code = text(formData, "code");
  const memberId = text(formData, "member_id");
  const first = text(formData, "first_name");
  const last = text(formData, "last_name");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_team", {
    p_code: code,
    p_member_id: memberId ? Number(memberId) : undefined,
    p_first_name: first || undefined,
    p_last_name: last,
  });
  if (error) {
    if (error.code === "P0001") return { error: strings.join.alreadyClaimed };
    if (error.code === "P0002") return { error: strings.join.notFound };
    return { error: strings.common.genericError };
  }
  redirect(`/t/${data}`);
}

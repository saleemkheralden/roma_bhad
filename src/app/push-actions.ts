"use server";

import { createClient } from "@/lib/supabase/server";
import { pushToUsers } from "@/lib/push";
import { strings } from "@/lib/strings";

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Save this device's push subscription for the signed-in user (RLS: own rows only). */
export async function savePushSubscription(sub: Sub) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid || !sub?.endpoint?.startsWith("https://")) return { error: strings.common.genericError };
  // Same device re-subscribing: replace its row.
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error } = await supabase
    .from("push_subscriptions")
    .insert({ user_id: uid, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth });
  if (error) return { error: strings.common.genericError };
  await pushToUsers([uid], {
    title: strings.notifications.welcomeTitle,
    body: strings.notifications.welcomeBody,
    url: "/",
    tag: "welcome",
  });
  return { ok: true };
}

export async function deletePushSubscription(endpoint: string) {
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true };
}

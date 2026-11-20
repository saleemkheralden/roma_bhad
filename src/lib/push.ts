import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import { createAdminClient } from "./supabase/admin";

// Web Push to a user's devices. Payloads are end-to-end encrypted (the push service can't
// read them) and kept short: a title, one line, and the page to open. No locations.

export type PushPayload = { title: string; body: string; url: string; tag?: string };

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  setVapidDetails(process.env.VAPID_SUBJECT || "mailto:roma.d.standard@gmail.com", pub, priv);
  configured = true;
  return true;
}

/** Sends to every device of these users. Dead subscriptions (404/410) are removed. */
export async function pushToUsers(userIds: (string | null | undefined)[], payload: PushPayload) {
  const ids = [...new Set(userIds.filter((u): u is string => Boolean(u)))];
  if (ids.length === 0 || !configure()) return { sent: 0 };
  const admin = createAdminClient();
  if (!admin) return { sent: 0 };

  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", ids);
  let sent = 0;
  const dead: number[] = [];
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 12 * 3600, urgency: "normal" },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
      }
    }),
  );
  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
  return { sent };
}

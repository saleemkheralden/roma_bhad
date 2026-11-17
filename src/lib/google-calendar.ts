import "server-only";
import { cacheLife } from "next/cache";
import { normalizeEvents, type CalEvent, type GoogleItem } from "./agenda";
import { signJwt, type Creds } from "./jwt";

// Reads team calendars with a Google service account (the calendar is shared with
// its email as "See all event details"). Server-only: the key never reaches the browser.
// Only id, title, status and times are requested: never location or description.

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function serviceAccount(): Creds | null {
  const email = process.env.GOOGLE_SA_EMAIL?.trim();
  const key = process.env.GOOGLE_SA_KEY?.replace(/\\n/g, "\n").trim();
  return email && key ? { email, key } : null;
}

/** The address calendars must be shared with (shown in the team settings). */
export function serviceAccountEmail() {
  return serviceAccount()?.email ?? null;
}

async function accessToken(creds: Creds) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signJwt(creds),
    }),
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export type CalendarResult =
  | { status: "ok"; events: CalEvent[]; notShared: string[] }
  | { status: "not-configured" }
  | { status: "error"; notShared: string[]; failed: boolean };

/**
 * Events for the given calendars from `fromDay` (YYYY-MM-DD, Israel) for `days` days.
 * Cached for about a minute per (calendars, day) so a busy morning doesn't hammer Google.
 */
export async function getCalendarEvents(ids: string[], fromDay: string, days: number): Promise<CalendarResult> {
  "use cache";
  cacheLife("minutes");

  const creds = serviceAccount();
  if (!creds) return { status: "not-configured" };
  if (ids.length === 0) return { status: "ok", events: [], notShared: [] };

  let token: string;
  try {
    token = await accessToken(creds);
  } catch {
    return { status: "error", notShared: [], failed: true };
  }

  // A day either side covers Israel's UTC offset; days are filtered in Israel time later.
  const timeMin = new Date(Date.parse(`${fromDay}T00:00:00Z`) - 86_400_000).toISOString();
  const timeMax = new Date(Date.parse(`${fromDay}T00:00:00Z`) + (days + 1) * 86_400_000).toISOString();
  const events: CalEvent[] = [];
  const notShared: string[] = [];
  let failed = false;

  await Promise.all(
    ids.map(async (id, source) => {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "100",
        timeZone: "Asia/Jerusalem",
        fields: "items(id,summary,status,start,end)",
      });
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.status === 404 || res.status === 403) {
        notShared.push(id);
        return;
      }
      if (!res.ok) {
        failed = true;
        return;
      }
      const data = (await res.json()) as { items?: GoogleItem[] };
      events.push(...normalizeEvents(data.items ?? [], source));
    }),
  );

  // Show what we could read; surface calendars that aren't shared with us.
  if (events.length === 0 && (notShared.length === ids.length || failed)) {
    return { status: "error", notShared, failed };
  }
  return { status: "ok", events, notShared };
}

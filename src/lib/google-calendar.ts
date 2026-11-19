import "server-only";
import { cacheLife } from "next/cache";
import { normalizeEvents, type CalEvent, type GoogleItem } from "./agenda";

// Reads team calendars as Roma's own Google account (e.g. the roma Gmail account), which the
// calendar owner shares calendars with ("See all event details"). The account authorised Roma
// once (scripts/connect-google-calendar.mjs, read-only scope); the refresh token lives only in
// server env. Only id, title, status and times are requested: never location or description.

const TOKEN_URL = "https://oauth2.googleapis.com/token";

type Creds = { clientId: string; clientSecret: string; refreshToken: string };

function credentials(): Creds | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN?.trim();
  return clientId && clientSecret && refreshToken ? { clientId, clientSecret, refreshToken } : null;
}

/** The address calendars must be shared with (shown in the team settings). */
export function calendarAccountEmail() {
  return credentials() ? process.env.GOOGLE_CALENDAR_ACCOUNT?.trim() || null : null;
}

async function accessToken(creds: Creds) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export type CalendarAccess =
  | { status: "ok"; name: string }
  | { status: "not-shared" }
  | { status: "not-configured" }
  | { status: "error" };

/** Can Roma's account read this calendar right now? Returns its name when it can. Uncached. */
export async function probeCalendar(id: string): Promise<CalendarAccess> {
  const creds = credentials();
  if (!creds) return { status: "not-configured" };
  try {
    const token = await accessToken(creds);
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}?fields=summary`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.status === 404 || res.status === 403) return { status: "not-shared" };
    if (!res.ok) return { status: "error" };
    const data = (await res.json()) as { summary?: string };
    return { status: "ok", name: (data.summary ?? "").trim().slice(0, 60) };
  } catch {
    return { status: "error" };
  }
}

/** Same check, cached about a minute: for status badges on page views. */
export async function calendarAccess(id: string): Promise<CalendarAccess> {
  "use cache";
  cacheLife("minutes");
  return probeCalendar(id);
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

  const creds = credentials();
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

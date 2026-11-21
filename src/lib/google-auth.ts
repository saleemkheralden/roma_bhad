import "server-only";

// Roma's own Google account, shared by the Calendar and Sheets readers. The account authorised
// Roma once with read-only scopes (scripts/connect-google-calendar.mjs); the refresh token lives
// only in server env. Calendars and sheets are shared with this account's address.

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export type Creds = { clientId: string; clientSecret: string; refreshToken: string };

export function credentials(): Creds | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN?.trim();
  return clientId && clientSecret && refreshToken ? { clientId, clientSecret, refreshToken } : null;
}

/** The address calendars and sheets must be shared with, or null when Roma isn't connected. */
export function romaAccountEmail() {
  return credentials() ? process.env.GOOGLE_CALENDAR_ACCOUNT?.trim() || null : null;
}

export async function accessToken(creds: Creds) {
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

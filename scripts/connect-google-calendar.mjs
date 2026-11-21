// One-time: let Roma read calendars and sheets as Roma's Google account (e.g. the roma Gmail account).
// Opens Google in the browser; sign in AS THAT ACCOUNT and allow "View your calendars" and "See your Google Sheets spreadsheets" (both read-only).
// Saves GOOGLE_OAUTH_CLIENT_ID / _SECRET, GOOGLE_CALENDAR_REFRESH_TOKEN and GOOGLE_CALENDAR_ACCOUNT
// to .env.local, and with --vercel also to Vercel (production + preview). Never prints secrets.
//
// Usage: node scripts/connect-google-calendar.mjs <client_secret_….json> [--vercel]
//   The JSON is an OAuth client of type "Desktop app" (Google Auth Platform → Clients).
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

// Read-only: calendars (titles and times) and sheets (cell values) shared with Roma's account.
const SCOPE = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
].join(" ");
const [path, flag] = process.argv.slice(2);
if (!path) {
  console.error("usage: node scripts/connect-google-calendar.mjs <client_secret.json> [--vercel]");
  process.exit(1);
}
const file = JSON.parse(readFileSync(path, "utf8"));
const client = file.installed ?? file.web;
if (!client?.client_id || !client?.client_secret) {
  console.error('That file is not an OAuth client JSON (expected "installed" or "web" with client_id/client_secret).');
  process.exit(1);
}

const verifier = randomBytes(48).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const state = randomBytes(16).toString("hex");

const server = createServer();
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const redirectUri = `http://127.0.0.1:${server.address().port}`;

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent select_account",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

console.log("Opening Google in your browser. Sign in as Roma's Google account (the one the calendar is shared with).");
console.log(`If it doesn't open, paste this into the browser:\n${authUrl}\n`);
const opener = process.platform === "win32" ? ["cmd", ["/c", "start", "", authUrl]] : [process.platform === "darwin" ? "open" : "xdg-open", [authUrl]];
spawn(opener[0], opener[1], { stdio: "ignore", detached: true }).unref();

const timeout = setTimeout(() => {
  console.error("Timed out after 5 minutes.");
  process.exit(1);
}, 5 * 60_000);

const code = await new Promise((resolve, reject) => {
  server.on("request", (req, res) => {
    const url = new URL(req.url, redirectUri);
    if (url.pathname !== "/") return res.end();
    const ok = url.searchParams.get("state") === state && url.searchParams.get("code");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      `<!doctype html><html dir="rtl" lang="he"><body style="font-family:sans-serif;padding:2rem">${
        ok ? "<h2>היומן חובר לרומא ✔</h2><p>אפשר לסגור את החלון.</p>" : "<h2>החיבור נכשל</h2><p>חזרו לטרמינל ונסו שוב.</p>"
      }</body></html>`,
    );
    if (ok) resolve(url.searchParams.get("code"));
    else reject(new Error(url.searchParams.get("error") || "state mismatch"));
  });
}).finally(() => {
  clearTimeout(timeout);
  server.close();
});

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: client.client_id,
    client_secret: client.client_secret,
    code_verifier: verifier,
  }),
});
const tokens = await tokenRes.json();
if (!tokenRes.ok || !tokens.refresh_token) {
  console.error(`Google didn't return a refresh token (${tokens.error ?? tokenRes.status}). Run the script again.`);
  process.exit(1);
}

// The account's own address = its primary calendar id (no extra scope needed).
const primary = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary?fields=id", {
  headers: { Authorization: `Bearer ${tokens.access_token}` },
}).then((r) => r.json());
const account = primary.id ?? "";

const values = {
  GOOGLE_OAUTH_CLIENT_ID: client.client_id,
  GOOGLE_OAUTH_CLIENT_SECRET: client.client_secret,
  GOOGLE_CALENDAR_REFRESH_TOKEN: tokens.refresh_token,
  GOOGLE_CALENDAR_ACCOUNT: account,
};

const envPath = ".env.local";
let env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
env = env
  .split(/\r?\n/)
  .filter((line) => !/^(GOOGLE_OAUTH_CLIENT_ID|GOOGLE_OAUTH_CLIENT_SECRET|GOOGLE_CALENDAR_REFRESH_TOKEN|GOOGLE_CALENDAR_ACCOUNT)=/.test(line))
  .join("\n")
  .replace(/\n*$/, "\n");
env += `\n# Roma's Google account for reading team calendars and sheets (read-only). Never commit.\n${Object.entries(values)
  .map(([k, v]) => `${k}=${v}`)
  .join("\n")}\n`;
writeFileSync(envPath, env);
console.log(`✓ Connected as ${account}. Saved to .env.local (secrets hidden).`);

if (flag === "--vercel") {
  for (const target of ["production", "preview"]) {
    for (const [name, value] of Object.entries(values)) {
      const sensitive = name === "GOOGLE_CALENDAR_ACCOUNT" || name === "GOOGLE_OAUTH_CLIENT_ID" ? [] : ["--sensitive"];
      const r = spawnSync("vercel", ["env", "add", name, target, "--force", ...sensitive], {
        input: value,
        encoding: "utf8",
        shell: process.platform === "win32",
      });
      console.log(r.status === 0 ? `✓ Vercel ${target}: ${name}` : `✗ Vercel ${target}: ${name} failed`);
    }
  }
  console.log("Redeploy for production to pick them up.");
}

import "server-only";
import { cacheLife } from "next/cache";
import { accessToken, credentials } from "./google-auth";
import { a1Range, toTable, type SheetRef, type Table } from "./sheets";

// Reads team sheets, read-only, as Roma's own Google account (the sheet is shared with it as a
// Viewer). Cell values are fetched when a page is viewed and kept in memory for about a minute;
// they are never written to the database.

const API = "https://sheets.googleapis.com/v4/spreadsheets";

export type SheetProblem =
  | "not-configured" // Roma isn't connected to Google at all
  | "needs-scope" // connected before Sheets existed: re-run the connect script
  | "api-disabled" // the Sheets API isn't enabled in Roma's Google Cloud project
  | "not-shared" // the sheet isn't shared with Roma's account (or doesn't exist)
  | "no-tab" // the tab was deleted or renamed away
  | "quota" // Google's per-minute limit
  | "error";

export type SheetMeta = { title: string; tabs: { gid: number; title: string }[] };

async function problemOf(res: Response): Promise<SheetProblem> {
  if (res.status === 429) return "quota";
  if (res.status === 404) return "not-shared";
  if (res.status === 403 || res.status === 401) {
    const body = await res.text().catch(() => "");
    if (/SERVICE_DISABLED|has not been used in project|is disabled/i.test(body)) return "api-disabled";
    return /SCOPE_INSUFFICIENT|insufficient authentication scopes/i.test(body) ? "needs-scope" : "not-shared";
  }
  return "error";
}

/** Title and tabs of a spreadsheet, or why Roma can't read it. Uncached (used when connecting). */
export async function probeSheet(spreadsheetId: string): Promise<{ ok: true; meta: SheetMeta } | { ok: false; problem: SheetProblem }> {
  const creds = credentials();
  if (!creds) return { ok: false, problem: "not-configured" };
  try {
    const token = await accessToken(creds);
    const res = await fetch(
      `${API}/${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties(sheetId,title)`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return { ok: false, problem: await problemOf(res) };
    const data = (await res.json()) as {
      properties?: { title?: string };
      sheets?: { properties?: { sheetId?: number; title?: string } }[];
    };
    const tabs = (data.sheets ?? [])
      .map((s) => ({ gid: s.properties?.sheetId ?? -1, title: s.properties?.title ?? "" }))
      .filter((t) => t.gid >= 0 && t.title);
    return { ok: true, meta: { title: (data.properties?.title ?? "").trim(), tabs } };
  } catch {
    return { ok: false, problem: "error" };
  }
}

export type SheetResult =
  | { status: "ok"; title: string; tab: string; table: Table; fetchedAt: string }
  | { status: "problem"; problem: SheetProblem };

/** The cells of one tab, as a tidy table. Cached about a minute per sheet/tab/range. */
export async function readSheet(ref: SheetRef): Promise<SheetResult> {
  "use cache";
  cacheLife("minutes");

  const probe = await probeSheet(ref.spreadsheetId);
  if (!probe.ok) return { status: "problem", problem: probe.problem };
  const tab = ref.gid === null ? probe.meta.tabs[0] : probe.meta.tabs.find((t) => t.gid === ref.gid);
  if (!tab) return { status: "problem", problem: "no-tab" };

  const creds = credentials();
  if (!creds) return { status: "problem", problem: "not-configured" };
  try {
    const token = await accessToken(creds);
    const params = new URLSearchParams({ majorDimension: "ROWS", valueRenderOption: "FORMATTED_VALUE" });
    const res = await fetch(
      `${API}/${encodeURIComponent(ref.spreadsheetId)}/values/${encodeURIComponent(a1Range(tab.title, ref.range))}?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return { status: "problem", problem: await problemOf(res) };
    const data = (await res.json()) as { values?: unknown };
    return { status: "ok", title: probe.meta.title, tab: tab.title, table: toTable(data.values), fetchedAt: new Date().toISOString() };
  } catch {
    return { status: "problem", problem: "error" };
  }
}

// Google Sheets helpers (Phase 3), pure so they can be unit-tested (scripts/test-sheets.ts).
//
// A connected sheet is stored in integrations as kind 'gsheet' with external_id
// "<spreadsheetId>#gid=<tab id>" and an optional "&range=A1:F40". Only that identifier is
// stored: the cells stay in Google and are read when the page is viewed.

export type SheetRef = { spreadsheetId: string; gid: number | null; range: string | null };

const ID = /^[A-Za-z0-9_-]{20,100}$/;
const RANGE = /^[A-Za-z]{1,3}[0-9]{0,7}(:[A-Za-z]{1,3}[0-9]{0,7})?$/;

/** Accepts a share/edit link (with #gid= or ?gid=) or a bare spreadsheet id. */
export function parseSheetInput(input: string, range = ""): SheetRef | null {
  const text = input.trim();
  let id: string | null = null;
  let gid: number | null = null;
  const fromUrl = text.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  if (fromUrl) {
    id = fromUrl[1];
    const g = text.match(/[#?&]gid=(\d+)/);
    if (g) gid = Number(g[1]);
  } else if (ID.test(text)) {
    id = text;
  }
  if (!id || !ID.test(id)) return null;
  const r = range.trim().toUpperCase();
  if (r && !RANGE.test(r)) return null;
  return { spreadsheetId: id, gid, range: r || null };
}

export function encodeSheetRef(ref: SheetRef): string {
  return `${ref.spreadsheetId}${ref.gid !== null ? `#gid=${ref.gid}` : ""}${ref.range ? `&range=${ref.range}` : ""}`;
}

export function decodeSheetRef(externalId: string): SheetRef | null {
  const m = externalId.match(/^([A-Za-z0-9_-]{20,100})(?:#gid=(\d+))?(?:&range=([A-Z0-9:]+))?$/);
  if (!m) return null;
  return { spreadsheetId: m[1], gid: m[2] !== undefined ? Number(m[2]) : null, range: m[3] ?? null };
}

/** The A1 range to request: the tab name quoted the way Sheets wants ('It''s'), capped in size. */
export function a1Range(tabTitle: string, range: string | null): string {
  const quoted = `'${tabTitle.replace(/'/g, "''")}'`;
  return `${quoted}!${range ?? `A1:${MAX_COL_LETTER}${MAX_ROWS}`}`;
}

export const MAX_ROWS = 300;
export const MAX_COLS = 15;
const MAX_COL_LETTER = "O"; // 15th column
const MAX_CELL = 200;

export type Table = { header: string[]; rows: string[][]; truncated: boolean };

/**
 * Turns Sheets "values" into a tidy table: the first non-empty row is the header, blank
 * rows and trailing blank columns are dropped, every row is padded to the same width, and
 * size is capped so a huge sheet can't swamp a phone.
 */
export function toTable(values: unknown): Table {
  const raw = Array.isArray(values) ? values : [];
  let truncated = raw.length > MAX_ROWS;
  const rows = raw.slice(0, MAX_ROWS).map((row) =>
    (Array.isArray(row) ? row : []).slice(0, MAX_COLS).map((cell) => {
      const s = cell == null ? "" : String(cell).trim();
      if (s.length > MAX_CELL) truncated = true;
      return s.slice(0, MAX_CELL);
    }),
  );
  if (raw.some((row) => Array.isArray(row) && row.length > MAX_COLS)) truncated = true;
  const nonEmpty = rows.filter((r) => r.some(Boolean));
  if (nonEmpty.length === 0) return { header: [], rows: [], truncated };

  let width = 0;
  for (const r of nonEmpty) {
    for (let i = r.length - 1; i >= 0; i--) {
      if (r[i]) {
        width = Math.max(width, i + 1);
        break;
      }
    }
  }
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => r[i] ?? "");
  const [header, ...body] = nonEmpty.map(pad);
  return { header: header.map((h, i) => h || `${i + 1}`), rows: body, truncated };
}

/** Rows whose cells contain every word of the query (case-insensitive, any order). */
export function filterRows(rows: string[][], query: string): string[][] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return rows;
  return rows.filter((r) => {
    const hay = r.join(" ").toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

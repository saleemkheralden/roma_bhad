// Google Calendar helpers: turn whatever the user pastes into a calendar ID,
// and build the embed URL. Only the ID is stored; events stay in Google.

const ID_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function fromBase64(s: string) {
  try {
    const padded = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return "";
  }
}

/**
 * Accepts: a calendar ID ("x@group.calendar.google.com", "name@gmail.com"), an embed URL
 * (".../calendar/embed?src=…"), an <iframe> snippet, a share link (".../calendar/u/0?cid=<base64>"),
 * or an iCal link (".../calendar/ical/<id>/public/basic.ics"). Returns the IDs found (deduped).
 */
export function parseCalendarIds(input: string): string[] {
  let text = input.trim();
  const iframe = text.match(/src\s*=\s*["']([^"']+)["']/i);
  if (iframe) text = iframe[1].replace(/&amp;/g, "&");

  if (ID_RE.test(text)) return [text.toLowerCase()];

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return [];
  }
  if (!/(^|\.)google\.com$/i.test(url.hostname)) return [];

  const ids: string[] = [];
  for (const src of url.searchParams.getAll("src")) ids.push(safeDecode(src));
  for (const cid of url.searchParams.getAll("cid")) {
    const decoded = fromBase64(cid);
    ids.push(ID_RE.test(decoded) ? decoded : safeDecode(cid));
  }
  const ical = url.pathname.match(/\/calendar\/ical\/([^/]+)\//);
  if (ical) ids.push(safeDecode(ical[1]));

  return [...new Set(ids.map((id) => id.trim().toLowerCase()).filter((id) => ID_RE.test(id)))];
}

export type EmbedMode = "AGENDA" | "WEEK" | "MONTH";

/** Embed URL for one or more calendars, in Hebrew and Israel time, without Google's chrome. */
export function embedUrl(ids: string[], mode: EmbedMode = "AGENDA") {
  const params = new URLSearchParams({
    ctz: "Asia/Jerusalem",
    hl: "iw",
    mode,
    showTitle: "0",
    showPrint: "0",
    showCalendars: "0",
    showTz: "0",
    wkst: "1",
    bgcolor: "#ffffff",
  });
  for (const id of ids) params.append("src", id);
  return `https://calendar.google.com/calendar/embed?${params.toString()}`;
}

/** Link to open the calendar in Google Calendar itself. */
export function openUrl(id: string) {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(id)}`;
}

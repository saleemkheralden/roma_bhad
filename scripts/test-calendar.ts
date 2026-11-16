// Unit checks for the calendar parser. Run: node scripts/test-calendar.ts
import assert from "node:assert/strict";
import { embedUrl, parseCalendarIds } from "../src/lib/calendar.ts";

const id = "abc123@group.calendar.google.com";
const b64 = Buffer.from(id).toString("base64").replace(/=+$/, "");

const cases: [string, string[]][] = [
  [id, [id]],
  ["  Team.Cal@gmail.com ", ["team.cal@gmail.com"]],
  [`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(id)}&ctz=Asia%2FJerusalem`, [id]],
  [`<iframe src="https://calendar.google.com/calendar/embed?src=${encodeURIComponent(id)}&amp;ctz=Asia%2FJerusalem" style="border: 0" width="800"></iframe>`, [id]],
  [`https://calendar.google.com/calendar/u/0?cid=${b64}`, [id]],
  [`https://calendar.google.com/calendar/ical/${encodeURIComponent(id)}/public/basic.ics`, [id]],
  [`https://calendar.google.com/calendar/embed?src=a%40group.calendar.google.com&src=b%40group.calendar.google.com`, ["a@group.calendar.google.com", "b@group.calendar.google.com"]],
  ["https://evil.example.com/calendar/embed?src=x%40y.com", []],
  ["not a calendar", []],
  ["", []],
];

for (const [input, expected] of cases) {
  assert.deepEqual(parseCalendarIds(input), expected, `input: ${input}`);
}

const url = new URL(embedUrl([id, "b@group.calendar.google.com"]));
assert.equal(url.hostname, "calendar.google.com");
assert.deepEqual(url.searchParams.getAll("src"), [id, "b@group.calendar.google.com"]);
assert.equal(url.searchParams.get("ctz"), "Asia/Jerusalem");
assert.equal(url.searchParams.get("mode"), "AGENDA");

console.log(`calendar parser: ${cases.length + 1} checks passed`);

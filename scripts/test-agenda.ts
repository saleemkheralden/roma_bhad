// Unit checks for calendar events and the service-account JWT. Run: node scripts/test-agenda.ts
import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { groupByDay, normalizeEvents } from "../src/lib/agenda.ts";
import { signJwt } from "../src/lib/jwt.ts";

let checks = 0;
const ok = (fn: () => void) => {
  fn();
  checks++;
};

// Timed event at 08:00 Israel time (UTC+2 in November).
const timed = normalizeEvents(
  [{ id: "a", summary: "שיעור ניווט", start: { dateTime: "2026-11-17T06:00:00Z" }, end: { dateTime: "2026-11-17T08:00:00Z" } }],
  0,
);
ok(() => assert.deepEqual(timed, [{ id: "a", title: "שיעור ניווט", day: "2026-11-17", start: "08:00", end: "10:00", allDay: false, source: 0 }]));

// A late-evening UTC time is the next day in Israel.
ok(() => assert.equal(normalizeEvents([{ id: "b", summary: "x", start: { dateTime: "2026-11-17T23:30:00Z" } }], 0)[0].day, "2026-11-18"));

// Multi-day all-day event appears on each day (end.date is exclusive).
const allDay = normalizeEvents([{ id: "c", summary: "חנוכה", start: { date: "2026-12-05" }, end: { date: "2026-12-07" } }], 1);
ok(() => assert.deepEqual(allDay.map((e) => e.day), ["2026-12-05", "2026-12-06"]));
ok(() => assert.ok(allDay.every((e) => e.allDay && e.start === null && e.source === 1)));

// Cancelled events and missing titles.
ok(() => assert.equal(normalizeEvents([{ id: "d", status: "cancelled", start: { date: "2026-11-17" } }], 0).length, 0));
ok(() => assert.equal(normalizeEvents([{ id: "e", start: { date: "2026-11-17" } }], 0)[0].title, "(ללא כותרת)"));

// Nothing but title and times survives, even if Google sent more.
const leaky = normalizeEvents(
  [{ id: "f", summary: "t", start: { dateTime: "2026-11-17T06:00:00Z" }, location: "בסיס", description: "פרטים" } as never],
  0,
);
ok(() => assert.deepEqual(Object.keys(leaky[0]).sort(), ["allDay", "day", "end", "id", "source", "start", "title"]));

// Grouping: range, order (all-day first), and day buckets.
const groups = groupByDay(
  [
    ...normalizeEvents([{ id: "g", summary: "late", start: { dateTime: "2026-11-17T15:00:00Z" } }], 0),
    ...normalizeEvents([{ id: "h", summary: "early", start: { dateTime: "2026-11-17T05:00:00Z" } }], 0),
    ...normalizeEvents([{ id: "i", summary: "all day", start: { date: "2026-11-17" }, end: { date: "2026-11-18" } }], 0),
    ...normalizeEvents([{ id: "j", summary: "tomorrow", start: { dateTime: "2026-11-18T07:00:00Z" } }], 0),
    ...normalizeEvents([{ id: "k", summary: "out of range", start: { dateTime: "2026-11-30T07:00:00Z" } }], 0),
  ],
  "2026-11-17",
  7,
);
ok(() => assert.deepEqual(groups.map((g) => g.day), ["2026-11-17", "2026-11-18"]));
ok(() => assert.deepEqual(groups[0].events.map((e) => e.title), ["all day", "early", "late"]));

// JWT: header/claims shape and a signature that verifies with the public key.
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const jwt = signJwt({ email: "roma@test.iam.gserviceaccount.com", key: pem }, 1_000_000);
const [h, c, sig] = jwt.split(".");
const claims = JSON.parse(Buffer.from(c, "base64url").toString());
ok(() => assert.deepEqual(JSON.parse(Buffer.from(h, "base64url").toString()), { alg: "RS256", typ: "JWT" }));
ok(() => assert.equal(claims.scope, "https://www.googleapis.com/auth/calendar.readonly"));
ok(() => assert.equal(claims.exp - claims.iat, 3600));
ok(() => assert.ok(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, "base64url"))));

console.log(`agenda + jwt: ${checks} checks passed`);

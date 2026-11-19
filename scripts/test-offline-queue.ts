// Unit checks for the offline roll-call queue. Run: npm run test:unit
import assert from "node:assert/strict";
import { compact, enqueue, isNetworkError, loadQueue, pendingFor, removeOp } from "../src/lib/offline-queue.ts";

let checks = 0;
const ok = (fn: () => void) => {
  fn();
  checks++;
};
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const op = (memberId: number, status: "present" | "late" | "absent" | null, at: number, sessionId = 1) => ({
  sessionId,
  teamId: 9,
  memberId,
  mark: status ? { status, reason: null } : null,
  at,
});

// Latest mark per cadet wins, ordered by the newest change.
ok(() => assert.deepEqual(compact([op(1, "present", 1), op(2, "late", 2), op(1, "absent", 3)]).map((o) => [o.memberId, o.mark?.status]), [[2, "late"], [1, "absent"]]));

// Survives "reload": stored and read back.
const s = mem();
enqueue(s, op(1, "present", 1));
enqueue(s, op(1, "late", 2));
enqueue(s, op(2, null, 3));
ok(() => assert.equal(loadQueue(s).length, 2));
ok(() => assert.equal(loadQueue(s).find((o) => o.memberId === 1)?.mark?.status, "late"));

// Removing a sent op leaves a newer one for the same cadet in place.
enqueue(s, op(1, "absent", 4));
removeOp(s, op(1, "late", 2)); // the old one was sent, the new one must stay
ok(() => assert.equal(loadQueue(s).find((o) => o.memberId === 1)?.mark?.status, "absent"));
removeOp(s, op(1, "absent", 4));
ok(() => assert.equal(loadQueue(s).some((o) => o.memberId === 1), false));

// Pending marks for one roll call only.
const p = pendingFor([op(1, "late", 1, 1), op(2, "present", 2, 2)], 1);
ok(() => assert.deepEqual([...p.keys()], [1]));

// Corrupt storage is ignored.
const bad = { getItem: () => "{not json", setItem: () => undefined };
ok(() => assert.deepEqual(loadQueue(bad), []));

// Network vs server errors.
ok(() => assert.equal(isNetworkError(null, false), true));
ok(() => assert.equal(isNetworkError({ message: "TypeError: Failed to fetch" }, true), true));
ok(() => assert.equal(isNetworkError({ message: "new row violates row-level security", code: "42501" }, true), false));

console.log(`offline queue: ${checks} checks passed`);

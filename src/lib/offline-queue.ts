// Roll-call write queue: every mark is queued on the phone first, then sent in order.
// With no reception the marks stay queued (and survive a reload) until the connection
// comes back. Only the latest mark per (session, cadet) is kept, so a late flush can never
// overwrite a newer mark. Pure functions; storage is injectable for tests.

export type QueuedMark = { status: "present" | "late" | "absent"; reason: string | null };
export type QueuedOp = { sessionId: number; teamId: number; memberId: number; mark: QueuedMark | null; at: number };

export const QUEUE_KEY = "roma:rollcall-queue:v1";
type Store = Pick<Storage, "getItem" | "setItem">;

const keyOf = (op: Pick<QueuedOp, "sessionId" | "memberId">) => `${op.sessionId}:${op.memberId}`;

/** Latest op per (session, member), ordered by when it was last changed. */
export function compact(ops: QueuedOp[]): QueuedOp[] {
  const latest = new Map<string, QueuedOp>();
  for (const op of ops) {
    latest.delete(keyOf(op)); // re-insert so order follows the newest change
    latest.set(keyOf(op), op);
  }
  return [...latest.values()];
}

export function loadQueue(store: Store | undefined): QueuedOp[] {
  try {
    const raw = store?.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as QueuedOp[]) : [];
    return Array.isArray(parsed) ? parsed.filter((o) => Number.isFinite(o?.sessionId) && Number.isFinite(o?.memberId)) : [];
  } catch {
    return [];
  }
}

export function saveQueue(store: Store | undefined, ops: QueuedOp[]) {
  try {
    store?.setItem(QUEUE_KEY, JSON.stringify(compact(ops)));
  } catch {
    // Storage full or blocked: the op stays in memory for this page only.
  }
}

let seq = 0;
/** Queue a mark; `at` is stamped here (strictly increasing) unless given. */
export function enqueue(store: Store | undefined, op: Omit<QueuedOp, "at"> & { at?: number }) {
  const stamped: QueuedOp = { ...op, at: op.at ?? Date.now() * 1000 + (seq++ % 1000) };
  const ops = compact([...loadQueue(store), stamped]);
  saveQueue(store, ops);
  return ops;
}

export function removeOp(store: Store | undefined, op: QueuedOp) {
  // Remove only if it's still the same op (a newer mark for the member may have replaced it).
  const ops = loadQueue(store).filter((o) => !(keyOf(o) === keyOf(op) && o.at === op.at));
  saveQueue(store, ops);
  return ops;
}

/** Marks queued for one roll call, by member, to show on top of the server's state. */
export function pendingFor(ops: QueuedOp[], sessionId: number) {
  return new Map(ops.filter((o) => o.sessionId === sessionId).map((o) => [o.memberId, o.mark] as const));
}

/** A failure worth retrying later (no reception), as opposed to a refusal from the server. */
export function isNetworkError(error: { message?: string; code?: string } | null | undefined, online: boolean) {
  if (!online) return true;
  if (!error) return false;
  return !error.code && /fetch|network|load failed|timed? ?out|offline/i.test(error.message ?? "");
}

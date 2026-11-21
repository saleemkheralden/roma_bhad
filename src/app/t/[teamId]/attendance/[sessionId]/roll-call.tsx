"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronRight, Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { strings } from "@/lib/strings";
import { summaryText, tally, type Mark, type Status } from "@/lib/attendance";
import { enqueue, isNetworkError, loadQueue, pendingFor, removeOp, type QueuedOp } from "@/lib/offline-queue";
import { Button, ErrorText } from "@/components/ui";
import { buttonClass } from "@/components/button-class";
import { TallyBar } from "@/components/section";
import type { ActionResult } from "@/components/ui";

const a = strings.attendance;
const NEXT: Record<Status | "none", Status | "none"> = {
  none: "present",
  present: "late",
  late: "absent",
  absent: "none",
};

type Person = { id: number; first_name: string; last_name: string };

const cellStyle: Record<Status | "none", string> = {
  none: "border-dashed border-rule-strong bg-paper text-ink",
  present: "border-present bg-paper text-ink",
  late: "border-now bg-now-wash text-ink",
  absent: "border-absent bg-absent-wash text-ink",
};
const statusInk: Record<Status | "none", string> = {
  none: "text-unmarked",
  present: "text-present-ink",
  late: "text-now-ink",
  absent: "text-absent-ink",
};
const statusLabel: Record<Status | "none", string> = {
  none: a.unmarked,
  present: a.present,
  late: a.late,
  absent: a.absent,
};

export function RollCall({
  teamId,
  sessionId,
  label,
  teamName,
  date,
  roster,
  initial,
  canEdit,
  deleteAction,
  backHref,
  doneHref,
}: {
  teamId: number;
  sessionId: number;
  label: string;
  teamName: string;
  date: string;
  roster: Person[];
  initial: Record<number, Mark>;
  canEdit: boolean;
  deleteAction: () => Promise<ActionResult>;
  backHref: string;
  doneHref: string;
}) {
  const router = useRouter();
  const [marks, setMarks] = useState(() => new Map<number, Mark>(Object.entries(initial).map(([k, v]) => [Number(k), v])));
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, startDelete] = useTransition();
  const reasonTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  // Marks saved on this phone but not yet on the server (no reception).
  const [pending, setPending] = useState(0);
  const [synced, setSynced] = useState(false);
  const flushing = useRef(false);
  // Bumped per cell on each change: the flip plays on change only, never on first render.
  const [flips, setFlips] = useState<Record<number, number>>({});
  const bump = (ids: number[]) =>
    setFlips((f) => ({ ...f, ...Object.fromEntries(ids.map((id) => [id, (f[id] ?? 0) + 1])) }));
  const t = tally(marks, roster.length);

  const store = () => (typeof window === "undefined" ? undefined : window.localStorage);
  const countMine = (ops: QueuedOp[]) => ops.filter((o) => o.sessionId === sessionId).length;

  // Sends queued marks for this roll call, oldest change first. Stops at the first network error.
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      const db = createClient();
      let hadOffline = false;
      const sent = new Set<string>(); // guards against a loop if storage can't be written
      // Keep going until the queue is empty: marks tapped while we were sending join this run.
      for (;;) {
        const batch = loadQueue(store()).filter(
          (o) => o.sessionId === sessionId && !sent.has(`${o.memberId}:${o.at}`),
        );
        if (batch.length === 0 || hadOffline) break;
        for (const op of batch) {
          const { error } = op.mark
            ? await db.from("attendance_entries").upsert(
                { session_id: op.sessionId, team_id: op.teamId, member_id: op.memberId, status: op.mark.status, reason: op.mark.reason || null },
                { onConflict: "session_id,member_id" },
              )
            : await db.from("attendance_entries").delete().eq("session_id", op.sessionId).eq("member_id", op.memberId);
          if (error && isNetworkError(error, navigator.onLine)) {
            hadOffline = true;
            break;
          }
          sent.add(`${op.memberId}:${op.at}`);
          removeOp(store(), op);
          if (error) {
            // Refused by the server (e.g. no permission any more): drop it and resync.
            setError(a.saveFailed);
            router.refresh();
          }
        }
      }
      const left = countMine(loadQueue(store()));
      setPending((before) => {
        if (before > 0 && left === 0 && !hadOffline) {
          setSynced(true);
          setTimeout(() => setSynced(false), 3000);
        }
        return left;
      });
    } finally {
      flushing.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // On open: show marks still waiting on this phone, then try to send them.
  useEffect(() => {
    const mine = pendingFor(loadQueue(store()), sessionId);
    // Deferred out of the effect body (no cascading render), then try to send.
    void Promise.resolve().then(() => {
      if (mine.size) {
        setMarks((m) => {
          const copy = new Map(m);
          for (const [memberId, mark] of mine) {
            if (mark) copy.set(memberId, mark);
            else copy.delete(memberId);
          }
          return copy;
        });
        setPending(mine.size);
      }
      return flush();
    });
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    const timer = setInterval(() => {
      if (countMine(loadQueue(store())) > 0 && navigator.onLine) void flush();
    }, 10_000);
    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flush, sessionId]);

  /** Every write goes through the queue, so order is kept even across lost reception. */
  function persist(memberId: number, mark: Mark | null) {
    const ops = enqueue(store(), { sessionId, teamId, memberId, mark: mark ? { status: mark.status, reason: mark.reason } : null });
    setPending(countMine(ops));
    void flush();
  }

  function cycle(memberId: number) {
    if (!canEdit) return;
    setError(null);
    const previous = marks.get(memberId);
    const next = NEXT[previous?.status ?? "none"];
    const mark = next === "none" ? null : { status: next, reason: next === "present" ? null : previous?.reason ?? null };
    setMarks((m) => {
      const copy = new Map(m);
      if (mark) copy.set(memberId, mark);
      else copy.delete(memberId);
      return copy;
    });
    bump([memberId]);
    persist(memberId, mark);
  }

  function markRestPresent() {
    setError(null);
    const rest = roster.filter((p) => !marks.has(p.id));
    if (rest.length === 0) return;
    setMarks((m) => {
      const copy = new Map(m);
      rest.forEach((p) => copy.set(p.id, { status: "present", reason: null }));
      return copy;
    });
    bump(rest.map((p) => p.id));
    let ops: QueuedOp[] = [];
    rest.forEach((p) => {
      ops = enqueue(store(), { sessionId, teamId, memberId: p.id, mark: { status: "present", reason: null } });
    });
    setPending(countMine(ops));
    void flush();
  }

  function setReason(memberId: number, reason: string) {
    const current = marks.get(memberId);
    if (!current) return;
    const mark = { ...current, reason };
    setMarks((m) => new Map(m).set(memberId, mark));
    const timers = reasonTimers.current;
    clearTimeout(timers.get(memberId));
    timers.set(memberId, setTimeout(() => persist(memberId, mark), 600));
  }

  async function copySummary() {
    const text = summaryText({ label, teamName, date, roster, marks });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(strings.common.genericError);
    }
  }

  const needsReason = roster.filter((p) => {
    const s = marks.get(p.id)?.status;
    return s === "late" || s === "absent";
  });

  return (
    <div className="pb-24">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={backHref}
            className="-ms-1 inline-flex min-h-9 items-center gap-0.5 text-sm font-bold text-ink-2 hover:text-ink"
          >
            <ChevronRight aria-hidden size={16} />
            {a.history}
          </Link>
          <h1 className="text-2xl font-extrabold leading-tight">
            {label || a.title} <span className="text-base font-medium text-ink-2">{date}</span>
          </h1>
        </div>
        <p className="border-b-4 border-now pb-0.5 text-[2.5rem] font-extrabold leading-none" aria-live="polite">
          {t.present}
          <span className="text-lg font-medium text-ink-2">/{t.total}</span>
        </p>
      </div>
      <TallyBar present={t.present} late={t.late} total={t.total} />
      {!canEdit ? (
        <p className="mt-2 text-sm text-ink-2">{a.readOnly}</p>
      ) : t.unmarked > 0 ? (
        <p className="mt-2 text-sm text-ink-2">{a.tapHint}</p>
      ) : null}

      <ul className="mt-3 grid grid-cols-3 gap-1.5">
        {roster.map((p) => {
          const mark = marks.get(p.id);
          const status = mark?.status ?? "none";
          const reason = status === "late" || status === "absent" ? mark?.reason?.trim() : "";
          const flip = flips[p.id] ?? 0;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => cycle(p.id)}
                disabled={!canEdit}
                aria-label={`${p.first_name} ${p.last_name}: ${statusLabel[status]}${reason ? `, ${reason}` : ""}`}
                className={`flex min-h-16 w-full rounded-[var(--radius-cell)] border text-start disabled:cursor-default ${cellStyle[status]}`}
              >
                <span
                  key={flip}
                  className={`flex w-full origin-top flex-col justify-between px-2 py-1.5 ${flip ? "animate-flip" : ""}`}
                >
                  <span className="block truncate text-[0.9375rem] font-bold leading-tight">{p.first_name}</span>
                  <span className="block truncate text-xs leading-tight text-ink-2">{p.last_name}</span>
                  <span className={`mt-0.5 block truncate text-xs font-bold ${statusInk[status]}`}>
                    {statusLabel[status]}
                    {reason ? ` · ${reason}` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {pending > 0 ? (
        <p role="status" className="mt-3 rounded-[var(--radius-cell)] bg-now-wash px-3 py-2 text-sm font-bold text-now-ink">
          {a.offlinePending(pending)}
        </p>
      ) : synced ? (
        <p role="status" className="mt-3 text-sm font-bold text-present-ink">
          {a.offlineSynced}
        </p>
      ) : null}
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>

      {canEdit && t.unmarked > 0 ? (
        <Button variant="outline" className="mt-3 w-full" onClick={markRestPresent}>
          {a.markRestPresent} ({t.unmarked})
        </Button>
      ) : null}

      {canEdit && needsReason.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-base font-extrabold">{a.reasons}</h2>
          <ul className="flex flex-col gap-2">
            {needsReason.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <label htmlFor={`reason-${p.id}`} className="w-28 shrink-0 truncate text-sm font-bold">
                  {p.first_name} {p.last_name}
                </label>
                <input
                  id={`reason-${p.id}`}
                  value={marks.get(p.id)?.reason ?? ""}
                  onChange={(e) => setReason(p.id, e.target.value.slice(0, 120))}
                  placeholder={a.reasonPlaceholder}
                  className="h-11 min-w-0 flex-1 rounded-[var(--radius-cell)] border border-rule-strong bg-paper px-3 text-base placeholder:text-ink-2"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canEdit ? (
        <div className="mt-20 border-t border-rule pt-6">
          <Button
            variant="danger"
            className="w-full"
            disabled={deleting}
            onClick={() => {
              if (!window.confirm(a.confirmDelete)) return;
              startDelete(async () => {
                const result = await deleteAction();
                if (result?.error) setError(result.error);
              });
            }}
          >
            {a.deleteSession}
          </Button>
        </div>
      ) : null}

      {/* Pinned above the tab bar so the summary is always in thumb reach. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-rule bg-ground px-4 py-2">
        <div className="mx-auto flex max-w-xl gap-2">
          <Button className="flex-1" onClick={copySummary}>
            {copied ? <Check aria-hidden size={20} /> : <Copy aria-hidden size={20} />}
            {copied ? strings.common.copied : a.copySummary}
          </Button>
          <Link href={doneHref} className={buttonClass("outline", "w-28")}>
            {a.done}
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { strings } from "@/lib/strings";
import { Button } from "@/components/ui";
import type { ActionResult } from "@/components/ui";

const s = strings.tasks;

type Member = { id: number; name: string };

/** A team task for the whole team: my checkbox, progress, and who's still missing. */
export function TeamWideTaskRow({
  title,
  notes,
  due,
  overdue,
  members,
  initialDone,
  myId,
  canCommand,
  setCompletion,
  closeTask,
  doing = false,
  checklist,
  editor,
}: {
  title: string;
  notes: string;
  due: string;
  overdue: boolean;
  members: Member[];
  initialDone: number[];
  myId: number | null;
  canCommand: boolean;
  setCompletion: (memberId: number, done: boolean) => Promise<ActionResult>;
  closeTask: (done: boolean) => Promise<ActionResult>;
  doing?: boolean;
  checklist?: ReactNode;
  editor?: ReactNode;
}) {
  const [done, setDone] = useState(() => new Set(initialDone));
  // When fresh server data arrives, adopt it without remounting (keeps the panel open).
  const serverKey = [...initialDone].sort((x, y) => x - y).join(",");
  const [seenKey, setSeenKey] = useState(serverKey);
  if (serverKey !== seenKey) {
    setSeenKey(serverKey);
    setDone(new Set(initialDone));
  }
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, startClose] = useTransition();
  const [, start] = useTransition();
  const mine = myId !== null && done.has(myId);
  const finished = members.filter((m) => done.has(m.id)).length;

  function toggle(memberId: number) {
    const next = !done.has(memberId);
    const apply = (on: boolean) =>
      setDone((d) => {
        const copy = new Set(d);
        if (on) copy.add(memberId);
        else copy.delete(memberId);
        return copy;
      });
    apply(next);
    setError(null);
    start(async () => {
      const result = await setCompletion(memberId, next);
      if (result?.error) {
        apply(!next);
        setError(result.error);
      }
    });
  }

  return (
    <li className="py-2.5">
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={mine}
          aria-label={mine ? s.unmarkMine(title) : s.markMine(title)}
          disabled={myId === null}
          onClick={() => myId !== null && toggle(myId)}
          className="-my-1.5 -ms-2 grid size-11 shrink-0 place-items-center disabled:cursor-default"
        >
          <span
            className={`grid size-7 place-items-center rounded-[var(--radius-cell)] border-2 ${
              mine ? "border-present bg-present text-paper" : "border-ink-2 bg-paper"
            }`}
          >
            {mine ? <Check aria-hidden size={18} strokeWidth={3} /> : null}
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-base font-bold leading-snug ${mine ? "text-ink-2 line-through" : ""}`}>{title}</p>
          {notes ? <p className="truncate text-sm text-ink-2">{notes}</p> : null}
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-2">
            {due ? (
              <span className={overdue ? "font-bold text-absent-ink" : "font-bold text-ink"}>
                {overdue ? `${s.groups.overdue} · ${due}` : due}
              </span>
            ) : null}
            <span>{s.everyone}</span>
            <span className="font-bold text-present-ink">{s.progress(finished, members.length)}</span>
            {doing && !mine ? <span className="font-bold text-now-ink">{s.doingTag}</span> : null}
          </p>
          <div className="flex flex-wrap items-center gap-x-4">
            {checklist}
            {editor}
          </div>
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="-my-1.5 -me-2 inline-flex h-11 shrink-0 items-center gap-0.5 px-2 text-xs font-bold text-ink-2 hover:text-ink"
        >
          {open ? s.hideWho : s.whoFinished}
          <ChevronDown aria-hidden size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open ? (
        <div className="mt-2 rounded-[var(--radius-control)] bg-paper p-3">
          {canCommand ? <p className="mb-2 text-xs text-ink-2">{s.commandMarksHint}</p> : null}
          <ul className="grid grid-cols-2 gap-1.5">
            {members.map((m) => {
              const isDone = done.has(m.id);
              const editable = canCommand || m.id === myId;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() => toggle(m.id)}
                    aria-label={isDone ? s.unmarkFor(m.name) : s.markFor(m.name)}
                    aria-pressed={isDone}
                    className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--radius-cell)] border px-2.5 text-start text-sm disabled:cursor-default ${
                      isDone ? "border-present bg-paper font-bold" : "border-dashed border-rule-strong bg-ground text-ink"
                    }`}
                  >
                    <span className="truncate">{m.name}</span>
                    <span className={`shrink-0 text-xs font-bold ${isDone ? "text-present-ink" : "text-unmarked"}`}>
                      {isDone ? s.finished : s.notYet}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {canCommand ? (
            <Button
              variant="outline"
              className="mt-3 w-full"
              disabled={closing}
              onClick={() =>
                startClose(async () => {
                  const result = await closeTask(true);
                  if (result?.error) setError(result.error);
                })
              }
            >
              {s.closeTask}
            </Button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-absent-ink">
          {error}
        </p>
      ) : null}
    </li>
  );
}

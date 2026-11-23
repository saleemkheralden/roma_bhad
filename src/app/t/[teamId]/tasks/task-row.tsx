"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Check } from "lucide-react";
import { strings } from "@/lib/strings";
import type { ActionResult } from "@/components/ui";
import { LinkedText } from "@/components/linked-text";

const s = strings.tasks;

export function TaskRow({
  title,
  notes,
  due,
  overdue,
  who,
  isPrivate,
  done: initialDone,
  canToggle,
  toggle,
  doing = false,
  checklist,
  editor,
}: {
  title: string;
  notes: string;
  due: string;
  overdue: boolean;
  who: string;
  isPrivate: boolean;
  done: boolean;
  canToggle: boolean;
  toggle: (done: boolean) => Promise<ActionResult>;
  doing?: boolean;
  checklist?: ReactNode;
  editor?: ReactNode;
}) {
  const [done, setDone] = useState(initialDone);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  function flip() {
    const next = !done;
    setDone(next);
    setError(null);
    start(async () => {
      const result = await toggle(next);
      if (result?.error) {
        setDone(!next);
        setError(result.error);
      }
    });
  }

  return (
    <li className="flex items-start gap-3 py-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? s.markOpen(title) : s.markDone(title)}
        disabled={!canToggle}
        onClick={flip}
        className="-my-1.5 -ms-2 grid size-11 shrink-0 place-items-center disabled:cursor-default"
      >
        <span
          className={`grid size-7 place-items-center rounded-[var(--radius-cell)] border-2 ${
            done ? "border-present bg-present text-paper" : canToggle ? "border-ink-2 bg-paper" : "border-dashed border-rule-strong bg-ground"
          }`}
        >
          {done ? <Check aria-hidden size={18} strokeWidth={3} /> : null}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-base font-bold leading-snug ${done ? "text-ink-2 line-through" : ""}`}>{title}</p>
        {notes ? <p className="truncate text-sm text-ink-2"><LinkedText text={notes} /></p> : null}
        <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-ink-2">
          {due ? (
            <span className={overdue && !done ? "font-bold text-absent-ink" : "font-bold text-ink"}>
              {overdue && !done ? `${s.groups.overdue} · ${due}` : due}
            </span>
          ) : null}
          <span>{who}</span>
          {doing && !done ? <span className="font-bold text-now-ink">{s.doingTag}</span> : null}
          {isPrivate ? <span className="font-bold text-ink">{s.privateTag}</span> : null}
        </p>
        {error ? (
          <p role="alert" className="mt-1 text-xs font-medium text-absent-ink">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4">
          {checklist}
          {editor}
        </div>
      </div>
    </li>
  );
}

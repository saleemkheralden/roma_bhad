"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, ChevronDown, ListChecks, ListPlus, Trash2 } from "lucide-react";
import { strings } from "@/lib/strings";
import type { ChecklistAccess } from "@/lib/tasks";
import { Button, ErrorText, SubmitButton, type ActionResult, type FormAction } from "@/components/ui";

const s = strings.tasks;

type Step = { id: number; text: string; done: boolean };

/** A task's steps: progress on the card, and a panel to tick, add and remove them. */
export function TaskChecklist({
  title,
  steps,
  access,
  taskOpen,
  setDone,
  remove,
  add,
}: {
  title: string;
  steps: Step[];
  access: ChecklistAccess;
  taskOpen: boolean;
  setDone: (itemId: number, done: boolean) => Promise<ActionResult>;
  remove: (itemId: number) => Promise<ActionResult>;
  add: FormAction;
}) {
  const [done, setDoneIds] = useState(() => new Set(steps.filter((x) => x.done).map((x) => x.id)));
  // When fresh server data arrives, adopt it without remounting (keeps the panel open).
  const serverKey = steps.map((x) => `${x.id}:${x.done ? 1 : 0}`).join(",");
  const [seenKey, setSeenKey] = useState(serverKey);
  if (serverKey !== seenKey) {
    setSeenKey(serverKey);
    setDoneIds(new Set(steps.filter((x) => x.done).map((x) => x.id)));
  }
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const [formKey, setFormKey] = useState(0);
  const [addState, addAction] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await add(prev, formData);
    if (result?.ok) setFormKey((k) => k + 1); // clear the input, keep focus flow simple
    return result;
  }, null);

  const canEdit = access === "edit";
  const canTick = access !== "read";
  if (steps.length === 0 && !canEdit) return null;

  const finished = steps.filter((x) => done.has(x.id)).length;
  const total = steps.length;
  const all = total > 0 && finished === total;

  function toggle(id: number) {
    const next = !done.has(id);
    const apply = (on: boolean) =>
      setDoneIds((d) => {
        const copy = new Set(d);
        if (on) copy.add(id);
        else copy.delete(id);
        return copy;
      });
    apply(next);
    setError(null);
    start(async () => {
      const result = await setDone(id, next);
      if (result?.error) {
        apply(!next);
        setError(result.error);
      }
    });
  }

  // `contents`: the toggle shares a line with the task's edit button; the panel takes a full row.
  return (
    <div className="contents">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="-ms-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-xs font-bold text-ink-2 hover:text-ink"
      >
        {total === 0 ? (
          <>
            <ListPlus aria-hidden size={16} />
            {s.addSteps}
          </>
        ) : (
          <>
            <ListChecks aria-hidden size={16} className={all ? "text-present-ink" : ""} />
            <span className={all ? "text-present-ink" : "text-ink"}>{s.steps(finished, total)}</span>
            <span aria-hidden className="relative h-1.5 w-14 overflow-hidden rounded-full bg-rule">
              <span
                className="absolute inset-y-0 start-0 rounded-full bg-present transition-[width] duration-300"
                style={{ width: `${(finished / total) * 100}%` }}
              />
            </span>
          </>
        )}
        <ChevronDown aria-hidden size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="order-last mt-1 basis-full rounded-[var(--radius-control)] bg-paper p-2">
          {total > 0 ? (
            <ul aria-label={s.stepsLabel(title)} className="flex flex-col">
              {steps.map((x) => {
                const isDone = done.has(x.id);
                return (
                  <li key={x.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isDone}
                      aria-label={isDone ? s.unmarkStep(x.text) : s.markStep(x.text)}
                      disabled={!canTick}
                      onClick={() => toggle(x.id)}
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[var(--radius-cell)] px-1 text-start disabled:cursor-default"
                    >
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-[var(--radius-cell)] border-2 ${
                          isDone
                            ? "border-present bg-present text-paper"
                            : canTick
                              ? "border-ink-2 bg-paper"
                              : "border-dashed border-rule-strong bg-ground"
                        }`}
                      >
                        {isDone ? <Check aria-hidden size={15} strokeWidth={3} /> : null}
                      </span>
                      <span className={`text-sm leading-snug ${isDone ? "text-ink-2 line-through" : "font-medium text-ink"}`}>
                        {x.text}
                      </span>
                    </button>
                    {removing && canEdit ? (
                      <Button
                        variant="icon-danger"
                        aria-label={s.removeStep(x.text)}
                        onClick={() =>
                          start(async () => {
                            const result = await remove(x.id);
                            if (result?.error) setError(result.error);
                          })
                        }
                      >
                        <Trash2 aria-hidden size={18} />
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {all && taskOpen && canTick ? <p className="px-1 pt-1 text-xs font-bold text-present-ink">{s.allStepsDone}</p> : null}
          {!canTick && taskOpen ? <p className="px-1 pt-1 text-xs text-ink-2">{s.stepsReadOnly}</p> : null}
          {error ? (
            <p role="alert" className="px-1 pt-1 text-xs font-medium text-absent-ink">
              {error}
            </p>
          ) : null}

          {canEdit ? (
            <>
              <form key={formKey} action={addAction} className="mt-2 flex items-end gap-2">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">{s.newStep}</span>
                  <input
                    name="text"
                    required
                    maxLength={120}
                    autoFocus={total === 0}
                    placeholder={s.newStep}
                    className="h-12 w-full rounded-[var(--radius-control)] border border-rule-strong bg-paper px-3 text-base text-ink placeholder:text-ink-2 focus:border-board focus:outline-none"
                  />
                </label>
                <SubmitButton variant="outline">{s.addStep}</SubmitButton>
              </form>
              <div className="mt-1">
                <ErrorText>{addState?.error}</ErrorText>
              </div>
              {total > 0 ? (
                <button
                  type="button"
                  aria-pressed={removing}
                  onClick={() => setRemoving((r) => !r)}
                  className="mt-1 inline-flex min-h-11 items-center gap-1 px-1 text-xs font-bold text-ink-2 hover:text-ink"
                >
                  <Trash2 aria-hidden size={14} />
                  {removing ? s.removeStepsDone : s.removeSteps}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

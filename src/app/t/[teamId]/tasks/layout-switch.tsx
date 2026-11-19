"use client";

import { useState, useTransition, type ReactNode } from "react";
import { CalendarDays, Columns3, List } from "lucide-react";
import { strings } from "@/lib/strings";
import { LAYOUTS, type TaskLayout } from "@/lib/tasks";
import type { ActionResult } from "@/components/ui";

const s = strings.tasks;
const ICONS = { list: List, board: Columns3, days: CalendarDays } as const;

/**
 * Picks how I see my tasks. The server sends all three panes, so switching is
 * instant; only the chosen one is mounted. The choice is saved for me in the
 * background. `afterList` (finished tasks) shows under the list and day views;
 * the board has its own "done" lane.
 */
export function LayoutSwitch({
  initial,
  save,
  panes,
  afterList,
}: {
  initial: TaskLayout;
  save: (layout: TaskLayout) => Promise<ActionResult>;
  panes: Record<TaskLayout, ReactNode>;
  afterList?: ReactNode;
}) {
  const [layout, setLayout] = useState(initial);
  const [, start] = useTransition();

  function pick(next: TaskLayout) {
    if (next === layout) return;
    setLayout(next);
    start(async () => {
      await save(next); // personal preference: a failed save only means it isn't remembered
    });
  }

  return (
    <>
      <div className="mt-3 flex items-center gap-2">
        <span id="layout-label" className="shrink-0 text-sm font-bold text-ink-2">
          {s.layoutLabel}
        </span>
        <div
          role="radiogroup"
          aria-labelledby="layout-label"
          className="grid flex-1 grid-cols-3 rounded-[var(--radius-control)] border border-rule bg-paper p-0.5"
        >
          {LAYOUTS.map((l) => {
            const Icon = ICONS[l];
            const on = layout === l;
            return (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pick(l)}
                className={`flex h-11 items-center justify-center gap-1.5 rounded-[var(--radius-cell)] text-sm font-bold ${
                  on ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"
                }`}
              >
                <Icon aria-hidden size={17} />
                {s.layouts[l]}
              </button>
            );
          })}
        </div>
      </div>
      {panes[layout]}
      {layout === "board" ? null : afterList}
    </>
  );
}

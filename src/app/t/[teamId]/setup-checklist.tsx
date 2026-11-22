"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, ChevronLeft } from "lucide-react";
import { strings } from "@/lib/strings";
import { Button } from "@/components/ui";

const s = strings.setup;

export type SetupStep = { key: string; label: string; hint: string; href: string; done: boolean; optional?: boolean };

// "Hide" is remembered on this phone only; storage can throw, then the list just stays.
const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function hiddenFor(key: string) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/** First-run setup for a new team's admins: each step ticks itself off from the team's real data. */
export function SetupChecklist({ teamId, steps }: { teamId: number; steps: SetupStep[] }) {
  const key = `roma:setup-hidden:${teamId}`;
  const hidden = useSyncExternalStore(subscribe, () => hiddenFor(key), () => false);
  const required = steps.filter((x) => !x.optional);
  const doneCount = required.filter((x) => x.done).length;
  if (hidden || doneCount === required.length) return null;

  return (
    <section aria-labelledby="setup-title" className="mb-8 rounded-[var(--radius-control)] border border-rule bg-paper p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="setup-title" className="text-xl font-extrabold">
          {s.title}
        </h2>
        <span className="text-sm font-bold text-ink-2">{s.progress(doneCount, required.length)}</span>
      </div>
      <p className="mt-1 text-sm text-ink-2">{s.intro}</p>
      <ol className="mt-3 divide-y divide-rule border-y border-rule">
        {steps.map((step) => (
          <li key={step.key}>
            <Link href={step.href} className="flex min-h-14 items-center gap-3 py-2 hover:bg-ground">
              <span
                aria-hidden
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${
                  step.done ? "border-present bg-present text-paper" : "border-rule-strong text-transparent"
                }`}
              >
                <Check size={16} strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-base font-bold ${step.done ? "text-ink-2 line-through" : ""}`}>
                  {step.label}
                  {step.optional ? <span className="ms-1.5 text-xs font-normal text-ink-2">({s.optional})</span> : null}
                </span>
                <span className="block text-sm text-ink-2">{step.hint}</span>
              </span>
              <span className="sr-only">{step.done ? s.doneSr : s.todoSr}</span>
              <ChevronLeft aria-hidden size={18} className="shrink-0 text-ink-2" />
            </Link>
          </li>
        ))}
      </ol>
      <Button
        variant="quiet"
        className="mt-2"
        onClick={() => {
          try {
            window.localStorage.setItem(key, "1");
          } catch {
            // ignore
          }
          listeners.forEach((fn) => fn());
        }}
      >
        {s.hide}
      </Button>
    </section>
  );
}

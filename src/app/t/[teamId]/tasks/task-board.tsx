"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import { strings } from "@/lib/strings";
import { LANES, type Lane } from "@/lib/tasks";
import type { ActionResult } from "@/components/ui";
import { useBoardDrag, type DropTarget } from "./use-board-drag";

const s = strings.tasks;

export type BoardCard = {
  id: number;
  title: string;
  notes: string;
  due: string;
  overdue: boolean;
  who: string;
  isPrivate: boolean;
  /** "3/12 סיימו" on team-wide tasks. */
  progress: string;
  /** The task's steps (progress, tick, add), the same component as in the list. */
  checklist: ReactNode;
  teamWide: boolean;
  /** I may mark it done / open again (mirrors RLS; the database still decides). */
  canFinish: boolean;
};

type Columns = Record<Lane, number[]>;
type Move = { from: Lane; to: Lane; teamWide: boolean; myMemberId: number | null; order: number[] };

/** Personal Kanban: to do → in progress → done, right to left. Lanes and order are mine only. */
export function TaskBoard({
  cards,
  columns: serverColumns,
  myId,
  move,
}: {
  cards: BoardCard[];
  columns: Columns;
  myId: number | null;
  move: (taskId: number, move: Move) => Promise<ActionResult>;
}) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const [columns, setColumns] = useState(serverColumns);
  // Adopt fresh server data (after any refresh) without remounting.
  const serverKey = LANES.map((l) => serverColumns[l].join(",")).join("|");
  const [seenKey, setSeenKey] = useState(serverKey);
  if (serverKey !== seenKey) {
    setSeenKey(serverKey);
    setColumns(serverColumns);
  }
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);

  const laneOfCard = (id: number) => LANES.find((l) => columns[l].includes(id)) ?? "todo";
  const allowed = (id: number, to: Lane) => {
    const from = laneOfCard(id);
    if (from === to) return true;
    // Crossing into or out of "done" changes the real task.
    return from !== "done" && to !== "done" ? true : Boolean(byId.get(id)?.canFinish);
  };

  function moveCard(id: number, to: Lane, beforeId: number | null) {
    const from = laneOfCard(id);
    if (!allowed(id, to)) return;
    const next: Columns = { todo: [...columns.todo], doing: [...columns.doing], done: [...columns.done] };
    next[from] = next[from].filter((x) => x !== id);
    const at = beforeId === null ? -1 : next[to].indexOf(beforeId);
    if (to === "done") next.done.unshift(id); // newest finished on top
    else if (at < 0) next[to].push(id);
    else next[to].splice(at, 0, id);
    if (LANES.every((l) => next[l].join() === columns[l].join())) return;
    const before = columns;
    setColumns(next);
    setError(null);
    start(async () => {
      const result = await move(id, {
        from,
        to,
        teamWide: Boolean(byId.get(id)?.teamWide),
        myMemberId: myId,
        order: next[to],
      });
      if (result?.error) {
        setColumns(before);
        setError(result.error);
      }
    });
  }

  const { dragStart, justDropped } = useBoardDrag({
    canDrop: (id, lane) => allowed(id, lane as Lane),
    onDrop: (id, target: DropTarget) => moveCard(id, target.lane as Lane, target.beforeId),
  });

  function jumpTo(lane: Lane) {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-lane="${lane}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  return (
    <div className="mt-4">
      <nav aria-label={s.lanesLabel} className="grid grid-cols-3 gap-1.5">
        {LANES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => jumpTo(l)}
            className="flex h-11 items-center justify-center gap-1.5 rounded-[var(--radius-cell)] border border-rule bg-paper text-sm font-bold text-ink"
          >
            <LaneDot lane={l} />
            {s.lanes[l]}
            <span className="text-xs font-medium text-ink-2">{columns[l].length}</span>
          </button>
        ))}
      </nav>
      <p className="mt-2 text-xs text-ink-2">{s.dragHint}</p>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-absent-ink">
          {error}
        </p>
      ) : null}

      <div
        ref={scroller}
        data-lanes=""
        className="-mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none]"
      >
        {LANES.map((lane) => (
          <section
            key={lane}
            data-lane={lane}
            aria-label={s.lanes[lane]}
            className="flex w-[78vw] max-w-72 shrink-0 snap-start flex-col rounded-[var(--radius-control)] border border-rule bg-rule/35 data-[drop]:border-now data-[drop]:bg-now-wash"
          >
            <h2 className="flex items-center gap-2 px-3 pb-1 pt-2.5 text-base font-extrabold">
              <LaneDot lane={lane} />
              {s.lanes[lane]}
              <span className="text-sm font-medium text-ink-2">{columns[lane].length}</span>
            </h2>
            <ul data-lane-body="" className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
              {columns[lane].length === 0 ? (
                <li className="grid min-h-20 place-items-center rounded-[var(--radius-cell)] border border-dashed border-rule-strong px-3 text-center text-sm text-ink-2">
                  {s.laneEmpty[lane]}
                </li>
              ) : null}
              {columns[lane].map((id) => {
                const card = byId.get(id);
                if (!card) return null;
                return (
                  <Card
                    key={id}
                    card={card}
                    lane={lane}
                    onPointerDown={(e) => dragStart(e, id)}
                    onMove={(to) => !justDropped() && moveCard(id, to, null)}
                  />
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function LaneDot({ lane }: { lane: Lane }) {
  const color = lane === "doing" ? "bg-now" : lane === "done" ? "bg-present" : "border-2 border-ink-2";
  return <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${color}`} />;
}

function Card({
  card,
  lane,
  onPointerDown,
  onMove,
}: {
  card: BoardCard;
  lane: Lane;
  onPointerDown: (e: React.PointerEvent<HTMLLIElement>) => void;
  onMove: (to: Lane) => void;
}) {
  const done = lane === "done";
  const moveButton = (to: Lane, label: string, icon: React.ReactNode, primary = false) => (
    <button
      type="button"
      onClick={() => onMove(to)}
      aria-label={s.moveTo(card.title, s.lanes[to])}
      className={`inline-flex min-h-11 items-center justify-center gap-1 rounded-[var(--radius-cell)] px-2.5 text-sm font-bold ${
        primary ? "bg-board text-board-ink" : "text-ink-2 hover:bg-ground hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <li
      data-card={card.id}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => e.preventDefault()}
      className={`cursor-grab touch-manipulation select-none rounded-[var(--radius-cell)] border bg-paper py-2.5 pe-1.5 ps-3 [-webkit-touch-callout:none] data-[drag-src]:opacity-35 ${
        lane === "doing" ? "border-now" : "border-rule"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-base font-bold leading-snug ${done ? "text-ink-2 line-through" : ""}`}>{card.title}</p>
          {card.notes ? <p className="truncate text-sm text-ink-2">{card.notes}</p> : null}
          <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-ink-2">
            {card.due ? (
              <span className={card.overdue && !done ? "font-bold text-absent-ink" : "font-bold text-ink"}>
                {card.overdue && !done ? `${s.groups.overdue} · ${card.due}` : card.due}
              </span>
            ) : null}
            {card.who ? <span>{card.who}</span> : null}
            {card.progress ? <span className="font-bold text-present-ink">{card.progress}</span> : null}
            {card.isPrivate ? <span className="font-bold text-ink">{s.privateTag}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-1">
          {lane === "todo" ? moveButton("doing", s.start, <ArrowLeft aria-hidden size={16} />, true) : null}
          {lane === "doing" ? (
            <>
              {card.canFinish ? moveButton("done", s.finish, <Check aria-hidden size={16} strokeWidth={3} />, true) : null}
              {moveButton("todo", s.back, <ArrowRight aria-hidden size={16} />)}
            </>
          ) : null}
          {done && card.canFinish ? moveButton("todo", s.reopen, <RotateCcw aria-hidden size={16} />) : null}
        </div>
      </div>
      {card.checklist ? (
        // Full card width. Pressing here never lifts the card, and text can be typed (the card is select-none).
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="flex cursor-auto select-text flex-wrap items-center gap-x-4 pe-1.5"
        >
          {card.checklist}
        </div>
      ) : null}
    </li>
  );
}

"use client";

import { useEffect, useRef } from "react";

// Pointer-event drag and drop for the task board (mouse, pen and touch), ported
// from Focus Board (github.com/DankoWiki/focus-board). On touch a card lifts
// after a short long-press, so a normal swipe still scrolls the page and lanes.
// Markup contract: lanes carry data-lane (and data-lane-body on the card list),
// cards carry data-card="<id>"; the horizontal scroller carries data-lanes.

export type DropTarget = { lane: string; beforeId: number | null };

type Pending = { el: HTMLElement; id: number; x0: number; y0: number; touch: boolean; timer: number };
type Active = {
  el: HTMLElement;
  id: number;
  ghost: HTMLElement;
  line: HTMLElement;
  ox: number;
  oy: number;
  x: number;
  y: number;
  target: DropTarget | null;
  scroller: HTMLElement | null;
  raf: number;
  edgeSince: number;
  lastPage: number;
};

const LONG_PRESS_MS = 240;

export function useBoardDrag({
  canDrop,
  onDrop,
}: {
  /** Whether this card may land in this lane (e.g. "done" needs permission to finish it). */
  canDrop: (id: number, lane: string) => boolean;
  onDrop: (id: number, target: DropTarget) => void;
}) {
  const cb = useRef({ canDrop, onDrop });
  useEffect(() => {
    cb.current = { canDrop, onDrop };
  });
  const state = useRef<{ pending: Pending | null; active: Active | null; justDropped: boolean }>({
    pending: null,
    active: null,
    justDropped: false,
  });
  const start = useRef<(e: React.PointerEvent, el: HTMLElement, id: number) => void>(() => {});

  useEffect(() => {
    const s = state.current;
    // While a card is lifted, a finger move must drag it, not scroll the page.
    const blockTouch = (e: TouchEvent) => {
      if (s.active) e.preventDefault();
    };
    document.addEventListener("touchmove", blockTouch, { passive: false });

    function findTarget(a: Active) {
      const line = a.line;
      const el = document.elementFromPoint(a.x, a.y);
      let laneEl = el?.closest<HTMLElement>("[data-lane]") ?? null;
      if (!laneEl && a.scroller) {
        // Forgiving drop: between lanes, use the nearest one.
        const sr = a.scroller.getBoundingClientRect();
        if (a.y >= sr.top && a.y <= sr.bottom) {
          let best: HTMLElement | null = null;
          let bd = Infinity;
          a.scroller.querySelectorAll<HTMLElement>("[data-lane]").forEach((c) => {
            const r = c.getBoundingClientRect();
            const d = a.x < r.left ? r.left - a.x : a.x > r.right ? a.x - r.right : 0;
            if (d < bd) {
              bd = d;
              best = c;
            }
          });
          if (bd < 120) laneEl = best;
        }
      }
      const lane = laneEl?.dataset.lane;
      if (!laneEl || !lane || !cb.current.canDrop(a.id, lane)) {
        a.target = null;
        line.hidden = true;
        laneEl = null;
      }
      document.querySelectorAll("[data-lane][data-drop]").forEach((n) => n.removeAttribute("data-drop"));
      if (!laneEl || !lane) return;
      laneEl.setAttribute("data-drop", "");
      const body = laneEl.querySelector<HTMLElement>("[data-lane-body]") ?? laneEl;
      const cards = [...body.querySelectorAll<HTMLElement>("[data-card]")].filter((c) => c !== a.el);
      let before: HTMLElement | null = null;
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        if (a.y < r.top + r.height / 2) {
          before = c;
          break;
        }
      }
      const br = body.getBoundingClientRect();
      let y: number;
      if (before) y = before.getBoundingClientRect().top - 6;
      else if (cards.length) y = cards[cards.length - 1].getBoundingClientRect().bottom + 3;
      else y = br.top + 8;
      y = Math.min(Math.max(y, br.top + 1), br.bottom - 4);
      Object.assign(line.style, {
        left: `${br.left + 8}px`,
        width: `${br.width - 16}px`,
        top: `${y}px`,
      });
      line.hidden = false;
      a.target = { lane, beforeId: before ? Number(before.dataset.card) : null };
    }

    function loop() {
      const a = s.active;
      if (!a) return;
      const sc = a.scroller;
      if (sc) {
        // At a side edge, page one lane over (then pause), instead of a fast
        // continuous scroll that flies past the middle lane on a phone.
        const r = sc.getBoundingClientRect();
        const edge = 44;
        const dir = a.x < r.left + edge ? -1 : a.x > r.right - edge ? 1 : 0;
        const now = performance.now();
        if (!dir) a.edgeSince = 0;
        else if (!a.edgeSince) a.edgeSince = now;
        else if (now - a.edgeSince > 220 && now - a.lastPage > 900) {
          const lane = sc.querySelector<HTMLElement>("[data-lane]");
          sc.scrollBy({ left: dir * ((lane?.offsetWidth ?? 280) + 12), behavior: "smooth" });
          a.lastPage = now;
        }
      }
      const top = 80;
      const bottom = window.innerHeight - 96; // above the tab bar
      let dy = 0;
      if (a.y < top) dy = -Math.ceil((top - a.y) / 4);
      else if (a.y > bottom) dy = Math.ceil((a.y - bottom) / 4);
      if (dy) window.scrollBy(0, dy);
      findTarget(a);
      a.raf = requestAnimationFrame(loop);
    }

    function placeGhost(a: Active) {
      a.ghost.style.transform = `translate(${a.x - a.ox}px, ${a.y - a.oy}px) rotate(-2deg)`;
    }

    function begin(p: Pending, x: number, y: number) {
      clearTimeout(p.timer);
      s.pending = null;
      if (!p.el.isConnected) return cleanup();
      const rect = p.el.getBoundingClientRect();
      const ghost = p.el.cloneNode(true) as HTMLElement;
      ghost.removeAttribute("data-card");
      ghost.setAttribute("aria-hidden", "true");
      Object.assign(ghost.style, {
        position: "fixed",
        top: "0",
        left: "0",
        zIndex: "90",
        width: `${rect.width}px`,
        pointerEvents: "none",
        margin: "0",
        opacity: "0.96",
        boxShadow: "0 12px 28px rgb(14 27 51 / 0.28)",
      });
      document.body.appendChild(ghost);
      const line = document.createElement("div");
      line.hidden = true;
      Object.assign(line.style, {
        position: "fixed",
        zIndex: "89",
        height: "3px",
        borderRadius: "var(--radius-cell)",
        background: "var(--color-now)",
        pointerEvents: "none",
      });
      document.body.appendChild(line);
      p.el.setAttribute("data-drag-src", "");
      document.body.setAttribute("data-dragging", "");
      const scroller = p.el.closest<HTMLElement>("[data-lanes]");
      if (scroller) scroller.style.scrollSnapType = "none";
      const a: Active = {
        el: p.el,
        id: p.id,
        ghost,
        line,
        ox: x - rect.left,
        oy: y - rect.top,
        x,
        y,
        target: null,
        scroller,
        raf: 0,
        edgeSince: 0,
        lastPage: 0,
      };
      s.active = a;
      try {
        if (p.touch) navigator.vibrate?.(8);
      } catch {}
      placeGhost(a);
      findTarget(a);
      loop();
    }

    function end() {
      const a = s.active;
      s.active = null;
      if (!a) return null;
      cancelAnimationFrame(a.raf);
      a.ghost.remove();
      a.line.remove();
      a.el.removeAttribute("data-drag-src");
      document.body.removeAttribute("data-dragging");
      document.querySelectorAll("[data-lane][data-drop]").forEach((n) => n.removeAttribute("data-drop"));
      if (a.scroller) a.scroller.style.scrollSnapType = "";
      return a;
    }

    function cleanup() {
      if (s.pending) clearTimeout(s.pending.timer);
      s.pending = null;
      if (!s.active) {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        window.removeEventListener("keydown", key, true);
      }
    }

    function move(e: PointerEvent) {
      const p = s.pending;
      if (p && !s.active) {
        const dist = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
        if (p.touch) {
          // Moved before the long-press fired: it's a scroll, not a drag.
          if (dist > 9) cleanup();
          return;
        }
        if (dist > 5) begin(p, e.clientX, e.clientY);
        else return;
      }
      const a = s.active;
      if (!a) return;
      e.preventDefault();
      a.x = e.clientX;
      a.y = e.clientY;
      placeGhost(a);
      findTarget(a);
    }

    function up() {
      const a = end();
      cleanup();
      if (!a) return;
      s.justDropped = true;
      setTimeout(() => (s.justDropped = false), 60);
      if (a.target) cb.current.onDrop(a.id, a.target);
    }

    function cancel() {
      end();
      cleanup();
    }

    function key(e: KeyboardEvent) {
      if (e.key === "Escape" && (s.active || s.pending)) {
        e.preventDefault();
        cancel();
      }
    }

    start.current = (e, el, id) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // Buttons inside a card stay buttons.
      if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
      cleanup();
      const p: Pending = {
        el,
        id,
        x0: e.clientX,
        y0: e.clientY,
        touch: e.pointerType === "touch",
        timer: 0,
      };
      s.pending = p;
      if (p.touch)
        p.timer = window.setTimeout(() => {
          if (s.pending === p) begin(p, p.x0, p.y0);
        }, LONG_PRESS_MS);
      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
      window.addEventListener("keydown", key, true);
    };

    return () => {
      document.removeEventListener("touchmove", blockTouch);
      cancel();
    };
  }, []);

  return {
    /** Spread onto a card: `onPointerDown={(e) => dragStart(e, id)}`. */
    dragStart: (e: React.PointerEvent<HTMLElement>, id: number) => start.current(e, e.currentTarget, id),
    /** True right after a drop, so the drop doesn't also count as a click. */
    justDropped: () => state.current.justDropped,
  };
}

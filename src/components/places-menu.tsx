"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, Plus, Users } from "lucide-react";
import { strings } from "@/lib/strings";
import type { Place, PlaceKind } from "@/lib/places";

const s = strings.places;
const LAST_COOKIE = "roma_last";

export function placeHref(p: { kind: PlaceKind; id: number }) {
  return `/${p.kind === "team" ? "t" : p.kind === "company" ? "c" : "b"}/${p.id}`;
}

/**
 * The unit name in the header doubles as a switcher: every team, company and battalion the
 * user belongs to, plus join/create. It also remembers the current place (cookie) so the
 * home page reopens it, instead of always the first team.
 */
export function PlacesMenu({ current, places }: { current: { kind: PlaceKind; id: number; name: string }; places: Place[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Remember where the user is (a plain first-party cookie, read by the home page).
  useEffect(() => {
    document.cookie = `${LAST_COOKIE}=${placeHref(current)}; path=/; max-age=31536000; samesite=lax`;
  }, [current]);

  // Close on navigation, outside tap and Escape.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const groups: { kind: PlaceKind; title: string }[] = [
    { kind: "team", title: s.teams },
    { kind: "company", title: s.companies },
    { kind: "battalion", title: s.battalions },
  ];

  return (
    <div ref={root} className="relative min-w-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="places-panel"
        onClick={() => setOpen((v) => !v)}
        className="-ms-1 flex min-h-11 max-w-full items-center gap-1 rounded-[var(--radius-cell)] px-1 text-start text-sm text-board-dim hover:text-board-ink"
      >
        <span className="sr-only">{s.switchLabel}: </span>
        <span className="truncate font-bold text-board-ink">{current.name}</span>
        <ChevronDown aria-hidden size={16} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          id="places-panel"
          className="absolute start-0 top-full z-50 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-[var(--radius-control)] border border-rule bg-paper p-2 text-ink shadow-lg"
        >
          {groups.map((g) => {
            const items = places.filter((p) => p.kind === g.kind);
            if (items.length === 0) return null;
            return (
              <div key={g.kind} className="py-1">
                <p className="px-2 pb-1 text-xs font-bold text-ink-2">{g.title}</p>
                <ul>
                  {items.map((p) => {
                    const here = p.kind === current.kind && p.id === current.id;
                    return (
                      <li key={`${p.kind}-${p.id}`}>
                        <Link
                          href={placeHref(p)}
                          aria-current={here ? "page" : undefined}
                          onClick={() => setOpen(false)}
                          className={`flex min-h-11 items-center justify-between gap-2 rounded-[var(--radius-cell)] px-2 text-base ${
                            here ? "bg-ground font-bold" : "hover:bg-ground"
                          }`}
                        >
                          <span className="truncate">{p.name}</span>
                          {here ? <Check aria-hidden size={18} className="shrink-0" /> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          <div className="mt-1 border-t border-rule pt-1">
            <Link href="/join" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-2 rounded-[var(--radius-cell)] px-2 text-sm font-bold hover:bg-ground">
              <Users aria-hidden size={18} />
              {s.join}
            </Link>
            <Link href="/new" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-2 rounded-[var(--radius-cell)] px-2 text-sm font-bold hover:bg-ground">
              <Plus aria-hidden size={18} />
              {s.create}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { strings } from "@/lib/strings";
import { filterRows, type Table } from "@/lib/sheets";
import { buttonClass } from "@/components/button-class";

const s = strings.sheets;

/**
 * A sheet on a phone: search across every cell, and either cards (one per row, label: value;
 * the default, readable one-handed) or the original table (scrolls sideways, header stays put).
 */
export function SheetView({ table }: { table: Table }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cards" | "table">(table.header.length > 4 ? "cards" : "table");
  const rows = filterRows(table.rows, query);

  if (table.header.length === 0) return <p className="text-base text-ink-2">{s.emptySheet}</p>;

  return (
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <span className="sr-only">{s.search}</span>
        <Search aria-hidden size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-2" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={s.searchPlaceholder}
          className="h-12 w-full rounded-[var(--radius-control)] border border-rule-strong bg-paper ps-10 pe-3 text-base text-ink placeholder:text-ink-2 focus:border-board focus:outline-none"
        />
      </label>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2" aria-live="polite">
          {s.rowsCount(rows.length, table.rows.length)}
        </p>
        <div role="group" aria-label={s.viewLabel} className="flex gap-1">
          {(["cards", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={buttonClass(view === v ? "primary" : "quiet")}
            >
              {v === "cards" ? s.cards : s.table}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-base text-ink-2">{s.noRows}</p>
      ) : view === "cards" ? (
        <ul className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li key={i} className="rounded-[var(--radius-control)] border border-rule bg-paper px-3 py-2.5">
              <p className="text-base font-bold">{r[0] || "—"}</p>
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                {r.slice(1).map((cell, j) =>
                  cell ? (
                    <div key={j} className="contents">
                      <dt className="text-ink-2">{table.header[j + 1]}</dt>
                      <dd className="min-w-0 break-words">{cell}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <div className="max-h-[70dvh] overflow-auto rounded-[var(--radius-control)] border border-rule bg-paper">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-ground">
              <tr>
                {table.header.map((h, i) => (
                  <th key={i} scope="col" className="border-b border-rule px-3 py-2 text-start font-extrabold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-rule last:border-b-0">
                  {r.map((cell, j) => (
                    <td key={j} className={`max-w-56 px-3 py-2 align-top ${j === 0 ? "font-bold" : ""}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

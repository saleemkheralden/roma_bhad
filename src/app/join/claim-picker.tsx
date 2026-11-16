"use client";

import { useState } from "react";
import { strings } from "@/lib/strings";
import { Field, SubmitButton } from "@/components/ui";

const s = strings.join;

type Unclaimed = { id: number; first_name: string; last_name: string };

/** Pick your own name from the unclaimed roster, or add yourself. */
export function ClaimPicker({ unclaimed }: { unclaimed: Unclaimed[] }) {
  const [choice, setChoice] = useState<number | "new" | null>(unclaimed.length ? null : "new");
  const chosen = typeof choice === "number" ? unclaimed.find((u) => u.id === choice) : null;

  return (
    <>
      {unclaimed.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-base font-bold">{s.pickYourself}</legend>
          <div className="grid grid-cols-2 gap-2">
            {unclaimed.map((u) => (
              <label
                key={u.id}
                className="flex min-h-12 cursor-pointer items-center rounded-[var(--radius-cell)] border border-rule bg-paper px-3 text-base font-medium has-checked:border-board has-checked:bg-board has-checked:text-board-ink"
              >
                <input
                  type="radio"
                  name="member_id"
                  value={u.id}
                  className="sr-only"
                  checked={choice === u.id}
                  onChange={() => setChoice(u.id)}
                />
                {[u.first_name, u.last_name].filter(Boolean).join(" ")}
              </label>
            ))}
          </div>
          <label className="flex min-h-12 cursor-pointer items-center rounded-[var(--radius-cell)] border border-dashed border-rule-strong px-3 text-base text-ink-2 has-checked:border-board has-checked:text-ink">
            <input
              type="radio"
              name="member_id"
              value=""
              className="sr-only"
              checked={choice === "new"}
              onChange={() => setChoice("new")}
            />
            {s.notInList}
          </label>
        </fieldset>
      ) : null}

      {choice === "new" ? (
        <div className="flex flex-col gap-4">
          <Field label={s.firstName} name="first_name" required maxLength={40} autoComplete="given-name" />
          <Field label={s.lastName} name="last_name" maxLength={40} autoComplete="family-name" />
        </div>
      ) : null}

      <SubmitButton disabled={choice === null}>
        {chosen ? s.joinAs([chosen.first_name, chosen.last_name].filter(Boolean).join(" ")) : s.joinNew}
      </SubmitButton>
    </>
  );
}

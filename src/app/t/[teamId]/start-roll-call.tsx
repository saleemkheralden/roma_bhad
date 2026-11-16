"use client";

import { useState } from "react";
import { strings } from "@/lib/strings";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/ui";
import type { ButtonVariant } from "@/components/button-class";

const a = strings.attendance;

/** Pick a label (בוקר / צהריים / ערב / other) and start a roll call. */
export function StartRollCall({
  action,
  defaultLabel,
  submitVariant = "primary",
}: {
  action: FormAction;
  defaultLabel: string;
  submitVariant?: ButtonVariant;
}) {
  const [label, setLabel] = useState(defaultLabel);
  const options = [...a.labels, "custom"];

  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <fieldset>
        <legend className="sr-only">{a.labelField}</legend>
        <div className="grid grid-cols-4 gap-1.5">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex h-11 cursor-pointer items-center justify-center rounded-[var(--radius-cell)] border border-rule bg-paper text-sm font-bold text-ink-2 has-checked:border-board has-checked:bg-board has-checked:text-board-ink"
            >
              <input
                type="radio"
                name="label"
                value={opt}
                checked={label === opt}
                onChange={() => setLabel(opt)}
                className="sr-only"
              />
              {opt === "custom" ? a.customLabel : opt}
            </label>
          ))}
        </div>
      </fieldset>
      {label === "custom" ? <Field label={a.labelField} name="custom_label" required maxLength={60} /> : null}
      <SubmitButton variant={submitVariant}>{a.start}</SubmitButton>
    </ActionForm>
  );
}

"use client";

import { useState } from "react";
import { ListPlus } from "lucide-react";
import { strings } from "@/lib/strings";
import { ActionForm, Field, SelectField, SubmitButton, TextArea, type FormAction } from "@/components/ui";

const s = strings.tasks;

export function NewTaskForm({
  action,
  canCommand,
  members,
  today,
}: {
  action: FormAction;
  canCommand: boolean;
  members: { id: number; name: string }[];
  today: string;
}) {
  const [visibility, setVisibility] = useState<"team" | "private">(canCommand ? "team" : "private");
  const [dueOn, setDueOn] = useState("");
  const [withSteps, setWithSteps] = useState(false);
  // Collapse the steps box again once the task is saved.
  const create: FormAction = async (prev, formData) => {
    const result = await action(prev, formData);
    if (result?.ok) setWithSteps(false);
    return result;
  };

  return (
    <ActionForm action={create} className="flex flex-col gap-3">
      <Field
        label={s.titleField}
        name="title"
        placeholder={s.titlePlaceholder}
        hint={s.titleHint}
        required
        maxLength={120}
      />

      {canCommand ? (
        <fieldset>
          <legend className="mb-1.5 text-sm font-bold">{s.visibility}</legend>
          <div className="grid grid-cols-2 gap-1.5">
            {(["team", "private"] as const).map((v) => (
              <label
                key={v}
                className="flex h-11 cursor-pointer items-center justify-center rounded-[var(--radius-cell)] border border-rule bg-paper text-sm font-bold text-ink-2 has-checked:border-board has-checked:bg-board has-checked:text-board-ink"
              >
                <input
                  type="radio"
                  name="visibility"
                  value={v}
                  checked={visibility === v}
                  onChange={() => setVisibility(v)}
                  className="sr-only"
                />
                {v === "team" ? s.visTeam : s.visPrivate}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <>
          <input type="hidden" name="visibility" value="private" />
          <p className="text-sm text-ink-2">{s.onlyCommandTeam}</p>
        </>
      )}

      {visibility === "team" ? (
        <SelectField label={s.assignee} name="assignee_member_id" defaultValue="">
          <option value="">{s.everyone}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </SelectField>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Field label={s.due} name="due_on" type="date" min={today} value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
        <Field label={s.time} name="due_time" type="time" disabled={!dueOn} />
      </div>
      <Field label={s.notes} name="notes" maxLength={500} />
      {withSteps ? (
        <TextArea label={s.stepsField} name="steps" hint={s.stepsHint} placeholder={s.stepsPlaceholder} autoFocus />
      ) : (
        <button
          type="button"
          onClick={() => setWithSteps(true)}
          className="-ms-1 inline-flex min-h-11 items-center gap-1.5 self-start px-1 text-sm font-bold text-ink-2 hover:text-ink"
        >
          <ListPlus aria-hidden size={18} />
          {s.addSteps}
        </button>
      )}
      <SubmitButton>{s.create}</SubmitButton>
    </ActionForm>
  );
}

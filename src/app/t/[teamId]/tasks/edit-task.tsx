"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { strings } from "@/lib/strings";
import { ErrorText, Field, SelectField, SubmitButton, type FormAction } from "@/components/ui";

const s = strings.tasks;

/** A small "edit" toggle under a task row that opens an inline form. */
export function EditTask({
  action,
  title,
  notes,
  dueOn,
  dueTime,
  assignee,
  isTeam,
  members,
}: {
  action: FormAction;
  title: string;
  notes: string;
  dueOn: string | null;
  dueTime: string | null;
  assignee: number | null;
  isTeam: boolean;
  members: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [due, setDue] = useState(dueOn ?? "");
  const [state, formAction] = useActionState(async (prev: Awaited<ReturnType<FormAction>>, formData: FormData) => {
    const result = await action(prev, formData);
    if (result?.ok) setOpen(false);
    return result;
  }, null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={s.editTitle(title)}
        className="-ms-1 mt-0.5 inline-flex min-h-9 items-center gap-1 px-1 text-xs font-bold text-ink-2 hover:text-ink"
      >
        <Pencil aria-hidden size={14} />
        {s.edit}
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2 rounded-[var(--radius-control)] bg-paper p-3">
      <Field label={s.titleField} name="title" defaultValue={title} required maxLength={120} hint={s.titleHint} />
      {isTeam ? (
        <SelectField label={s.assignee} name="assignee_member_id" defaultValue={assignee ? String(assignee) : ""}>
          <option value="">{s.everyone}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </SelectField>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Field label={s.due} name="due_on" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <Field label={s.time} name="due_time" type="time" defaultValue={dueTime?.slice(0, 5) ?? ""} disabled={!due} />
      </div>
      <Field label={s.notes} name="notes" defaultValue={notes} maxLength={500} />
      <ErrorText>{state?.error}</ErrorText>
      <div className="flex gap-2">
        <SubmitButton className="flex-1">{s.save}</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-12 rounded-[var(--radius-control)] px-4 text-base font-bold text-ink-2 hover:bg-ground"
        >
          {strings.common.cancel}
        </button>
      </div>
    </form>
  );
}

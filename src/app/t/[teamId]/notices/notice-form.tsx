"use client";

import { useActionState, useState } from "react";
import { Pencil, ShieldAlert } from "lucide-react";
import { strings } from "@/lib/strings";
import { ActionForm, ErrorText, Field, SubmitButton, TextArea, type FormAction } from "@/components/ui";

const s = strings.notices;

type Audience = "team" | "command";

/** Title, body, audience and expiry: shared by compose and edit. */
function NoticeFields({
  title = "",
  body = "",
  audience: initialAudience = "team",
  expiresOn = null,
  today,
}: {
  title?: string;
  body?: string;
  audience?: Audience;
  expiresOn?: string | null;
  today: string;
}) {
  const [audience, setAudience] = useState<Audience>(initialAudience);
  return (
    <>
      <p className="flex items-start gap-2 rounded-[var(--radius-cell)] bg-now-wash px-3 py-2 text-sm font-medium text-now-ink">
        <ShieldAlert aria-hidden size={18} className="mt-0.5 shrink-0" />
        {s.securityNote}
      </p>
      <Field
        label={s.titleField}
        name="title"
        placeholder={s.titlePlaceholder}
        defaultValue={title}
        required
        maxLength={80}
      />
      <TextArea label={s.bodyField} name="body" defaultValue={body} maxLength={1000} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-bold">{s.audience}</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {(["team", "command"] as const).map((v) => (
            <label
              key={v}
              className="flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--radius-cell)] border border-rule bg-paper px-2 py-1 text-center text-sm font-bold leading-tight text-ink-2 has-checked:border-board has-checked:bg-board has-checked:text-board-ink"
            >
              <input
                type="radio"
                name="audience"
                value={v}
                checked={audience === v}
                onChange={() => setAudience(v)}
                className="sr-only"
              />
              {v === "team" ? s.audienceTeam : s.audienceCommand}
            </label>
          ))}
        </div>
        {audience === "command" ? <p className="mt-1.5 text-sm text-ink-2">{s.audienceCommandHint}</p> : null}
      </fieldset>
      <Field label={s.expires} name="expires_on" type="date" min={today} defaultValue={expiresOn ?? ""} />
    </>
  );
}

export function NewNoticeForm({ action, today }: { action: FormAction; today: string }) {
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <NoticeFields today={today} />
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base font-bold">
        <input type="checkbox" name="pinned" className="size-5 accent-[var(--color-board)]" />
        {s.pin}
      </label>
      <SubmitButton>{s.post}</SubmitButton>
    </ActionForm>
  );
}

/** A small "edit" toggle under a notice that opens an inline form. */
export function EditNotice({
  action,
  title,
  body,
  audience,
  expiresOn,
  today,
}: {
  action: FormAction;
  title: string;
  body: string;
  audience: Audience;
  expiresOn: string | null;
  today: string;
}) {
  const [open, setOpen] = useState(false);
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
        className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-bold text-ink-2 hover:text-ink"
      >
        <Pencil aria-hidden size={16} />
        {s.edit}
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 flex w-full flex-col gap-3 rounded-[var(--radius-control)] bg-ground p-3">
      <NoticeFields title={title} body={body} audience={audience} expiresOn={expiresOn} today={today} />
      <ErrorText>{state?.error}</ErrorText>
      <div className="flex gap-2">
        <SubmitButton className="flex-1">{s.save}</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-12 rounded-[var(--radius-control)] px-4 text-base font-bold text-ink-2 hover:bg-paper"
        >
          {strings.common.cancel}
        </button>
      </div>
    </form>
  );
}

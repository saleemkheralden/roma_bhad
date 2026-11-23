import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { strings } from "@/lib/strings";
import { ActionForm, Field, SelectField, SubmitButton, type ActionResult } from "@/components/ui";

// Shared editing parts for roles and role assignments, used by the team, company and
// battalion pages so all three edit the same way.

const s = strings.roleEditing;

type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

/**
 * One row in a manage list: the summary, an "edit" toggle that opens a pre-filled form under
 * it, and the remove button kept apart on the side.
 */
export function EditRow({ summary, editLabel, remove, children }: { summary: ReactNode; editLabel: string; remove?: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <details className="group min-w-0 flex-1">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1 truncate text-sm">{summary}</span>
          <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-ink-2 group-open:text-ink">
            <Pencil aria-hidden size={14} />
            <span>{s.edit}</span>
            <span className="sr-only">{editLabel}</span>
          </span>
        </summary>
        <div className="mb-3 mt-1 rounded-[var(--radius-control)] border border-rule bg-paper p-3">{children}</div>
      </details>
      {remove ? <div className="shrink-0">{remove}</div> : null}
    </li>
  );
}

/** Rename a role, and say whether it's a command role (roll call, tasks, managing). */
export function RoleEditForm({ action, name, isCommand }: { action: FormAction; name: string; isCommand: boolean }) {
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <Field label={strings.team.roleName} name="name" required maxLength={40} defaultValue={name} />
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input type="checkbox" name="is_command" defaultChecked={isCommand} className="mt-1 size-5 shrink-0 accent-[var(--color-board)]" />
        <span>
          <span className="block font-bold">{s.isCommand}</span>
          <span className="block text-ink-2">{s.isCommandHint}</span>
        </span>
      </label>
      <SubmitButton variant="outline">{strings.common.save}</SubmitButton>
    </ActionForm>
  );
}

/**
 * Change who holds a role and when. personName/personOptions differ per level: a team picks
 * from its roster (member_id), a company or battalion from cadets and staff (person = "t:id" / "m:id").
 */
export function AssignmentEditForm({
  action,
  roles,
  roleId,
  personName,
  personDefault,
  personOptions,
  start,
  end,
}: {
  action: FormAction;
  roles: { id: number; name: string }[];
  roleId: number;
  personName: "member_id" | "person";
  personDefault: string;
  personOptions: ReactNode;
  start: string;
  end: string;
}) {
  return (
    <ActionForm action={action} className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <SelectField label={strings.team.role} name="role_id" required defaultValue={String(roleId)}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </SelectField>
        <SelectField label={strings.team.member} name={personName} required defaultValue={personDefault}>
          {personOptions}
        </SelectField>
        <Field label={strings.team.from} name="start_date" type="date" required defaultValue={start} />
        <Field label={strings.team.to} name="end_date" type="date" required defaultValue={end} />
      </div>
      <p className="text-xs text-ink-2">{s.datesHint}</p>
      <SubmitButton variant="outline">{strings.common.save}</SubmitButton>
    </ActionForm>
  );
}

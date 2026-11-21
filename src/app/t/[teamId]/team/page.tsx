import { Suspense } from "react";
import { headers } from "next/headers";
import { ChevronDown, Trash2 } from "lucide-react";
import { fullName, getCalendars, getTeamContext } from "@/lib/data";
import { calendarAccess, calendarAccountEmail } from "@/lib/google-calendar";
import { shortDate, weekdayOf } from "@/lib/dates";
import { strings } from "@/lib/strings";
import { Section } from "@/components/section";
import { ActionForm, Field, SelectField, SubmitButton, TextArea } from "@/components/ui";
import { ActionButton, CopyButton } from "@/components/action-button";
import { EditArea } from "@/components/edit-area";
import {
  addCalendar,
  addAssignment,
  addMember,
  addRole,
  importMembers,
  regenerateInvite,
  removeAssignment,
  removeIntegration,
  removeMember,
  removeRole,
  setMemberFlag,
  updateMember,
} from "../actions";

const s = strings.team;

async function Team({ params }: { params: Promise<{ teamId: string }> }) {
  const teamId = Number((await params).teamId);
  const [ctx, calendars] = await Promise.all([getTeamContext(teamId), getCalendars(teamId)]);
  const { can_manage: canManage, is_admin: isAdmin } = ctx.permissions;
  const c = strings.calendar;
  const romaAccount = calendarAccountEmail();
  const access = await Promise.all(calendars.map((cal) => calendarAccess(cal.external_id)));
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const inviteUrl = `${origin}/join?code=${ctx.team.invite_code}`;
  const rolesByMember = new Map<number, string[]>();
  for (const d of ctx.onDuty) rolesByMember.set(d.member.id, [...(rolesByMember.get(d.member.id) ?? []), d.role.name]);
  const assignments = [...ctx.onDuty, ...ctx.upcoming];

  return (
    <>
      <h1 className="sr-only">{s.title}</h1>

      <Section id="roster" title={s.roster} aside={<span className="text-base font-bold text-ink-2">{ctx.roster.length}</span>}>
        <ul className="divide-y divide-rule border-y border-rule">
          {ctx.roster.map((m) => {
            const isMe = ctx.me?.id === m.id;
            const row = (
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold">
                  {fullName(m)}
                  {isMe ? <span className="ms-1.5 text-xs font-normal text-ink-2">· {strings.common.you}</span> : null}
                </p>
                <p className="flex flex-wrap gap-x-2 text-xs text-ink-2">
                  <span className={m.user_id ? "text-present-ink" : ""}>{m.user_id ? s.joined : s.notJoined}</span>
                  {m.is_admin ? <span className="font-bold text-ink">{s.admin}</span> : null}
                  {m.is_staff ? <span className="font-bold text-ink">{s.staff}</span> : null}
                  {(rolesByMember.get(m.id) ?? []).map((r) => (
                    <span key={r} className="font-bold text-now-ink">{r}</span>
                  ))}
                </p>
              </div>
            );
            const canRemove = canManage && !isMe;
            if (!isAdmin && !canManage) {
              return (
                <li key={m.id} className="flex min-h-14 items-center py-2">
                  {row}
                </li>
              );
            }
            return (
              <li key={m.id}>
                <details className="group">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 py-2 [&::-webkit-details-marker]:hidden">
                    {row}
                    <ChevronDown aria-hidden size={20} className="shrink-0 text-ink-2 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mb-3 flex flex-col gap-4 rounded-[var(--radius-control)] bg-paper p-3">
                    {canManage ? (
                      <ActionForm action={updateMember.bind(null, teamId, m.id)} className="flex flex-col gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Field label={strings.join.firstName} name="first_name" defaultValue={m.first_name} required maxLength={40} />
                          <Field label={strings.join.lastName} name="last_name" defaultValue={m.last_name} maxLength={40} />
                        </div>
                        <SubmitButton variant="outline">{s.editName}</SubmitButton>
                      </ActionForm>
                    ) : null}
                    {isAdmin ? (
                      <div className="flex flex-wrap gap-2">
                        <ActionButton action={setMemberFlag.bind(null, teamId, m.id, "is_admin", !m.is_admin)} variant="outline">
                          {m.is_admin ? s.removeAdmin : s.makeAdmin}
                        </ActionButton>
                        <ActionButton action={setMemberFlag.bind(null, teamId, m.id, "is_staff", !m.is_staff)} variant="outline">
                          {m.is_staff ? s.removeStaff : s.makeStaff}
                        </ActionButton>
                      </div>
                    ) : null}
                    {canRemove ? (
                      <div className="mt-1 border-t border-rule pt-3">
                        <ActionButton
                          action={removeMember.bind(null, teamId, m.id)}
                          confirm={`${strings.common.remove}: ${fullName(m)}?`}
                          variant="danger"
                        >
                          <Trash2 aria-hidden size={18} />
                          {strings.common.remove}
                        </ActionButton>
                      </div>
                    ) : null}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>

        {canManage ? (
          <ActionForm action={addMember.bind(null, teamId)} className="mt-4 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label={strings.join.firstName} name="first_name" required maxLength={40} />
              <Field label={strings.join.lastName} name="last_name" maxLength={40} />
            </div>
            <SubmitButton variant="outline">{s.addMember}</SubmitButton>
          </ActionForm>
        ) : null}
        {canManage ? (
          <EditArea
            title={s.pasteList}
            add={
              <ActionForm action={importMembers.bind(null, teamId)} className="flex flex-col gap-2">
                <TextArea label={s.pasteLabel} hint={s.pasteHint} name="names" placeholder={s.pastePlaceholder} required />
                <SubmitButton variant="outline">{s.pasteSubmit}</SubmitButton>
              </ActionForm>
            }
          />
        ) : null}
      </Section>

      <Section id="assignments" title={s.assignments}>
        {assignments.length === 0 ? (
          <p className="text-base text-ink-2">{s.noAssignments}</p>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {assignments.map((d) => {
              const current = d.startDate <= ctx.today;
              return (
                <li key={d.assignmentId} className="py-2.5">
                  <p className="truncate text-base">
                    <span className="font-bold">{d.role.name}</span> · {fullName(d.member)}
                  </p>
                  <p className="text-xs text-ink-2">
                    <span className={current ? "font-bold text-now-ink" : ""}>{current ? s.current : s.upcoming}</span>
                    {" · "}
                    {weekdayOf(d.startDate)} {shortDate(d.startDate)} – {weekdayOf(d.endDate)} {shortDate(d.endDate)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        {canManage && ctx.roles.length > 0 ? (
          <EditArea
            title={s.manageAssignments}
            add={
              <ActionForm action={addAssignment.bind(null, teamId)} className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <SelectField label={s.role} name="role_id" required defaultValue="">
                    <option value="" disabled>—</option>
                    {ctx.roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </SelectField>
                  <SelectField label={s.member} name="member_id" required defaultValue="">
                    <option value="" disabled>—</option>
                    {ctx.roster.map((m) => (
                      <option key={m.id} value={m.id}>{fullName(m)}</option>
                    ))}
                  </SelectField>
                  <Field label={s.from} name="start_date" type="date" required defaultValue={ctx.today} />
                  <Field label={s.to} name="end_date" type="date" required defaultValue={ctx.today} />
                </div>
                <SubmitButton variant="outline">{s.assign}</SubmitButton>
              </ActionForm>
            }
            remove={
              assignments.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {assignments.map((d) => (
                    <li key={d.assignmentId} className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm">
                        <span className="font-bold">{d.role.name}</span> · {fullName(d.member)} · {shortDate(d.startDate)}
                      </span>
                      <ActionButton
                        action={removeAssignment.bind(null, teamId, d.assignmentId)}
                        label={`${strings.common.remove} ${d.role.name} ${fullName(d.member)}`}
                        variant="icon-danger"
                      >
                        <Trash2 aria-hidden size={18} />
                      </ActionButton>
                    </li>
                  ))}
                </ul>
              ) : null
            }
          />
        ) : null}
      </Section>

      <Section title={s.roles}>
        <ul className="flex flex-wrap gap-2">
          {ctx.roles.map((r) => (
            <li key={r.id} className="rounded-[var(--radius-cell)] border border-rule bg-paper px-3 py-2 text-base font-bold">
              {r.name}
            </li>
          ))}
        </ul>
        {canManage ? (
          <EditArea
            title={s.manageRoles}
            add={
              <ActionForm action={addRole.bind(null, teamId)} className="flex items-end gap-2">
                <div className="flex-1">
                  <Field label={s.roleName} name="name" required maxLength={40} />
                </div>
                <SubmitButton variant="outline">{s.addRole}</SubmitButton>
              </ActionForm>
            }
            remove={
              <ul className="flex flex-col gap-2">
                {ctx.roles.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold">{r.name}</span>
                    <ActionButton
                      action={removeRole.bind(null, teamId, r.id)}
                      confirm={`${strings.common.remove}: ${r.name}?`}
                      label={`${strings.common.remove} ${r.name}`}
                      variant="icon-danger"
                    >
                      <Trash2 aria-hidden size={18} />
                    </ActionButton>
                  </li>
                ))}
              </ul>
            }
          />
        ) : null}
      </Section>

      <Section id="calendar" title={c.settings}>
        {calendars.length === 0 ? (
          <p className="text-base text-ink-2">{c.empty}</p>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {calendars.map((cal, i) => {
              const a = access[i];
              return (
                <li key={cal.id} className="py-2.5">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-base font-bold">{cal.label || c.title}</span>
                    {a.status === "ok" ? (
                      <span className="text-xs font-bold text-present-ink">{c.statusOk}</span>
                    ) : a.status === "not-shared" || a.status === "error" ? (
                      <span className="text-xs font-bold text-absent-ink">{c.statusNotShared}</span>
                    ) : null}
                  </p>
                  <p dir="ltr" className="truncate text-start text-sm text-ink-2">
                    {cal.external_id}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {canManage ? (
          <EditArea
            title={c.connect}
            add={
              <ActionForm action={addCalendar.bind(null, teamId)} className="flex flex-col gap-3">
                {romaAccount ? (
                  <ol className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-rule bg-paper p-3 text-sm">
                    <li>
                      <span className="font-bold">1. </span>
                      {c.step1}
                      <span dir="ltr" className="mt-1 block break-all text-start font-bold">{romaAccount}</span>
                      <span className="mt-2 block">
                        <CopyButton text={romaAccount}>{c.copyEmail}</CopyButton>
                      </span>
                    </li>
                    <li>
                      <span className="font-bold">2. </span>
                      {c.step2}
                    </li>
                  </ol>
                ) : (
                  <p className="text-sm text-ink-2">{c.settingsHint}</p>
                )}
                <Field label={c.field} name="calendar" placeholder={c.placeholder} dir="ltr" required maxLength={2000} />
                <Field label={romaAccount ? c.labelAuto : c.label} name="label" placeholder={c.labelPlaceholder} maxLength={60} />
                <p className="rounded-[var(--radius-cell)] bg-now-wash px-3 py-2 text-sm font-medium text-now-ink">
                  {c.securityNote}
                </p>
                {romaAccount ? null : <p className="text-sm text-ink-2">{c.privateNote}</p>}
                <SubmitButton variant="outline">{c.connect}</SubmitButton>
              </ActionForm>
            }
            remove={
              calendars.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {calendars.map((cal) => (
                    <li key={cal.id} className="flex items-center justify-between gap-3">
                      <span dir="ltr" className="truncate text-sm font-bold">{cal.label || cal.external_id}</span>
                      <ActionButton
                        action={removeIntegration.bind(null, teamId, cal.id)}
                        confirm={`${strings.common.remove}: ${cal.label || cal.external_id}?`}
                        label={`${strings.common.remove} ${cal.label || cal.external_id}`}
                        variant="icon-danger"
                      >
                        <Trash2 aria-hidden size={18} />
                      </ActionButton>
                    </li>
                  ))}
                </ul>
              ) : null
            }
          />
        ) : null}
      </Section>

      <Section id="invite" title={s.invite}>
        <div className="rounded-[var(--radius-control)] border border-rule bg-paper p-4">
          <p dir="ltr" className="text-center text-[2rem] font-extrabold tracking-[0.2em]">
            {ctx.team.invite_code}
          </p>
          <p className="mt-2 text-sm text-ink-2">{s.inviteHint}</p>
          <div className="mt-4 flex flex-wrap items-start gap-2">
            <CopyButton text={inviteUrl}>{s.copyLink}</CopyButton>
            {isAdmin ? (
              <ActionButton action={regenerateInvite.bind(null, teamId)} variant="outline">
                {s.newCode}
              </ActionButton>
            ) : null}
          </div>
        </div>
      </Section>

      <form action="/auth/signout" method="post" className="mt-12">
        <button className="h-11 px-3 text-sm font-medium text-ink-2 underline">{strings.common.signOut}</button>
      </form>
    </>
  );
}

export default function TeamPage({ params }: PageProps<"/t/[teamId]/team">) {
  return (
    <Suspense fallback={<p className="text-ink-2">{strings.common.loading}</p>}>
      <Team params={params} />
    </Suspense>
  );
}

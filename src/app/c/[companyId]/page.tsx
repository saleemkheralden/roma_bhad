import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { connection } from "next/server";
import { ChevronRight, Trash2 } from "lucide-react";
import { getCompanyContext, getCompanyDashboard, type DashboardTeam } from "@/lib/company-data";
import { getMyTeams } from "@/lib/data";
import { clock, dayLabel, shortDate, untilLabel, weekdayOf } from "@/lib/dates";
import { strings } from "@/lib/strings";
import { Section, TallyBar } from "@/components/section";
import { ActionForm, Field, SelectField, SubmitButton } from "@/components/ui";
import { ActionButton, CopyButton } from "@/components/action-button";
import { EditArea } from "@/components/edit-area";
import { PlacesMenu } from "@/components/places-menu";
import { getMyAdminUnits, getMyPlaces } from "@/lib/places";
import {
  addMyTeamToCompany,
  createTeamInCompany,
  addTeamToCompany,
  removeTeamFromCompany,
  addCompanyAssignment,
  addCompanyRole,
  regenerateCompanyCode,
  removeCompanyAssignment,
  removeCompanyMember,
  removeCompanyRole,
  setCompanyAdmin,
} from "../actions";
import { leaveBattalion } from "../../b/actions";

const c = strings.company;
const a = strings.attendance;

export const metadata = { title: c.dashboard };

function TeamCard({ t, mine }: { t: DashboardTeam; mine: boolean }) {
  const rc = t.roll_call;
  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-extrabold">
          {/* Your own team opens; other teams stay read-only summaries. */}
          {mine ? (
            <Link href={`/t/${t.team_id}`} className="underline decoration-rule-strong underline-offset-4">
              {t.team_name}
            </Link>
          ) : (
            t.team_name
          )}
        </h3>
        <span className="text-sm text-ink-2">{t.roster}</span>
      </div>

      {rc ? (
        <div className="mt-1">
          <p className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-bold">
              {c.rollCall}: {rc.label || a.title}
            </span>
            <span className="font-extrabold">{c.present(rc.present, t.roster)}</span>
          </p>
          <div className="mt-1.5">
            <TallyBar present={rc.present} late={rc.exceptions.filter((e) => e.status === "late").length} total={t.roster} />
          </div>
          {rc.exceptions.length ? (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {rc.exceptions.map((e) => (
                <li key={e.name} className="flex items-baseline gap-2">
                  <span className={`w-12 shrink-0 font-bold ${e.status === "late" ? "text-now-ink" : "text-absent-ink"}`}>
                    {e.status === "late" ? a.late : a.absent}
                  </span>
                  <span className="font-bold">{e.name}</span>
                  {e.reason ? <span className="truncate text-ink-2">· {e.reason}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 text-sm text-ink-2">{c.noRollCall}</p>
      )}

      <p className="mt-2 flex flex-wrap gap-x-3 text-sm">
        {t.roles_today.length ? (
          <span>
            <span className="text-ink-2">{c.rolesToday}: </span>
            {t.roles_today.map((r) => `${r.role} ${r.name}`).join(" · ")}
          </span>
        ) : null}
        <span className="font-bold">{c.openTasks(t.open_tasks)}</span>
        {t.overdue_tasks > 0 ? <span className="font-bold text-absent-ink">{c.overdue(t.overdue_tasks)}</span> : null}
      </p>
    </li>
  );
}

async function Company({ params }: { params: Promise<{ companyId: string }> }) {
  const companyId = Number((await params).companyId);
  // Context first: a non-member gets "not found" before the dashboard's permission check runs.
  const ctx = await getCompanyContext(companyId);
  const [teams, myTeams, places, adminUnits] = await Promise.all([
    getCompanyDashboard(companyId),
    getMyTeams(),
    getMyPlaces(),
    getMyAdminUnits(),
  ]);
  // Teams I admin that aren't in this company yet: one tap to add.
  const myOtherTeams = adminUnits.teams.filter((x) => x.company_id !== companyId);
  const myTeamIds = new Set(myTeams.map((x) => x.id));
  await connection();
  const now = new Date();
  const h = await headers();
  const inviteUrl = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/join?code=${ctx.company.invite_code}`;
  const assignments = [...ctx.onDuty, ...ctx.upcoming];
  // The company's people come from its teams, grouped by team for the role picker and the list.
  const peopleByTeam = [...ctx.people.reduce((map, p) => map.set(p.team_name, [...(map.get(p.team_name) ?? []), p]), new Map<string, typeof ctx.people>())];

  return (
    <>
      <header className="bg-board pb-3 pt-[max(env(safe-area-inset-top),1rem)] text-board-ink">
        <div className="mx-auto max-w-xl px-4">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <Link href="/" className="text-[1.375rem] font-extrabold leading-tight">
                {strings.app.name}
              </Link>
              <PlacesMenu current={{ kind: "company", id: companyId, name: ctx.company.name }} places={places} />
            </div>
            <p className="shrink-0 text-sm font-bold text-now">
              {dayLabel(now)} · {clock(now)}
            </p>
          </div>
          {myTeams.length ? (
            <nav aria-label={c.myTeams} className="mt-2 flex flex-wrap gap-2">
              {myTeams.map((x) => (
                <Link
                  key={x.id}
                  href={`/t/${x.id}`}
                  className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-control)] border border-board-rule px-3 text-sm font-bold"
                >
                  <ChevronRight aria-hidden size={16} />
                  {c.backToTeam(x.name)}
                </Link>
              ))}
            </nav>
          ) : null}
          {ctx.onDuty.length ? (
            <ul className="mt-3 border-t border-board-rule">
              {ctx.onDuty.map(({ a: x, role, member }) => (
                <li key={x.id} className="flex h-10 items-center gap-3 border-b border-board-2 text-[0.9375rem] last:border-b-0">
                  <span className="w-[6.5rem] truncate font-bold text-now">{role.name}</span>
                  <span className="flex-1 truncate">{member.name}{member.detail ? ` (${member.detail})` : ""}</span>
                  <span className="text-sm text-board-dim">{untilLabel(x.end_date, ctx.today)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 border-t border-board-rule pt-3 text-base text-board-dim">{c.nobodyOnDuty}</p>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 pt-4">
        <h1 className="sr-only">{c.dashboard}</h1>
        <Section title={c.teams} aside={<span className="text-base font-bold text-ink-2">{teams.length}</span>}>
          {teams.length === 0 ? (
            <p className="text-base text-ink-2">{c.noTeams}</p>
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {teams.map((t) => (
                <TeamCard key={t.team_id} t={t} mine={myTeamIds.has(t.team_id)} />
              ))}
            </ul>
          )}
          {ctx.isAdmin ? (
            <EditArea
              title={c.manageTeams}
              add={
                <div className="flex flex-col gap-5">
                  {myOtherTeams.length ? (
                    <div>
                      <p className="text-sm font-bold">{c.myTeams}</p>
                      <p className="text-xs text-ink-2">{c.myTeamsHint}</p>
                      <ul className="mt-2 flex flex-col gap-2">
                        {myOtherTeams.map((x) => (
                          <li key={x.id} className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate text-sm font-bold">
                              {x.name}
                              {x.company_id ? <span className="ms-1.5 text-xs font-normal text-ink-2">({c.inOtherCompany})</span> : null}
                            </span>
                            <ActionButton action={addMyTeamToCompany.bind(null, companyId, x.id)} variant="outline">
                              {c.addThis}
                            </ActionButton>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <ActionForm action={createTeamInCompany.bind(null, companyId)} className="flex flex-col gap-2">
                    <p className="text-sm font-bold">{c.newTeamInCompany}</p>
                    <p className="text-xs text-ink-2">{c.newTeamHint}</p>
                    <Field label={strings.create.teamName} name="name" required maxLength={60} />
                    <div className="grid grid-cols-2 gap-2">
                      <Field label={strings.create.yourFirstName} name="first_name" required maxLength={40} autoComplete="given-name" />
                      <Field label={strings.create.yourLastName} name="last_name" maxLength={40} autoComplete="family-name" />
                    </div>
                    <SubmitButton variant="outline">{c.newTeamInCompany}</SubmitButton>
                  </ActionForm>

                  <details>
                    <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold underline">{c.withCode}</summary>
                    <ActionForm action={addTeamToCompany.bind(null, companyId)} className="mt-2 flex flex-col gap-2">
                      <p className="text-sm text-ink-2">{c.addTeamHint}</p>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Field
                            label={c.teamCode}
                            name="code"
                            required
                            dir="ltr"
                            maxLength={8}
                            autoCapitalize="characters"
                            autoComplete="off"
                            className="tracking-[0.2em] uppercase"
                          />
                        </div>
                        <SubmitButton variant="outline">{c.addTeam}</SubmitButton>
                      </div>
                    </ActionForm>
                  </details>
                </div>
              }
              remove={
                teams.length ? (
                  <ul className="flex flex-col gap-2">
                    {teams.map((t) => (
                      <li key={t.team_id} className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-bold">{t.team_name}</span>
                        <ActionButton
                          action={removeTeamFromCompany.bind(null, companyId, t.team_id)}
                          confirm={c.confirmRemoveTeam(t.team_name)}
                          label={`${strings.common.remove} ${t.team_name}`}
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

        <Section title={c.assignments}>
          {assignments.length === 0 ? (
            <p className="text-base text-ink-2">{strings.team.noAssignments}</p>
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {assignments.map(({ a: x, role, member }) => (
                <li key={x.id} className="py-2.5">
                  <p className="text-base">
                    <span className="font-bold">{role.name}</span> · {member.name}
                    {member.detail ? <span className="text-sm text-ink-2"> ({member.detail})</span> : null}
                  </p>
                  <p className="text-xs text-ink-2">
                    {weekdayOf(x.start_date)} {shortDate(x.start_date)} – {weekdayOf(x.end_date)} {shortDate(x.end_date)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {ctx.canManage ? (
            <EditArea
              title={c.manageAssignments}
              add={
                <ActionForm action={addCompanyAssignment.bind(null, companyId)} className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <SelectField label={strings.team.role} name="role_id" required defaultValue="">
                      <option value="" disabled>—</option>
                      {ctx.roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </SelectField>
                    <SelectField label={strings.team.member} name="person" required defaultValue="">
                      <option value="" disabled>—</option>
                      {peopleByTeam.map(([teamName, list]) => (
                        <optgroup key={teamName} label={teamName}>
                          {list.map((p) => (
                            <option key={p.team_member_id} value={`t:${p.team_member_id}`}>{p.name}</option>
                          ))}
                        </optgroup>
                      ))}
                      {ctx.members.length ? (
                        <optgroup label={c.staffGroup}>
                          {ctx.members.map((m) => (
                            <option key={m.id} value={`m:${m.id}`}>{m.display_name}</option>
                          ))}
                        </optgroup>
                      ) : null}
                    </SelectField>
                    <Field label={strings.team.from} name="start_date" type="date" required defaultValue={ctx.today} />
                    <Field label={strings.team.to} name="end_date" type="date" required defaultValue={ctx.today} />
                  </div>
                  <SubmitButton variant="outline">{strings.team.assign}</SubmitButton>
                </ActionForm>
              }
              remove={
                assignments.length ? (
                  <ul className="flex flex-col gap-2">
                    {assignments.map(({ a: x, role, member }) => (
                      <li key={x.id} className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm">
                          <span className="font-bold">{role.name}</span> · {member.name} · {shortDate(x.start_date)}
                        </span>
                        <ActionButton
                          action={removeCompanyAssignment.bind(null, companyId, x.id)}
                          label={`${strings.common.remove} ${role.name} ${member.name}`}
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

        <Section title={c.people} aside={<span className="text-base font-bold text-ink-2">{ctx.people.length}</span>}>
          {ctx.people.length === 0 ? (
            <p className="text-base text-ink-2">{c.noPeople}</p>
          ) : (
            <>
              <p className="mb-2 text-sm text-ink-2">{c.peopleHint}</p>
              <ul className="divide-y divide-rule border-y border-rule">
                {peopleByTeam.map(([teamName, list]) => (
                  <li key={teamName}>
                    <details>
                      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 py-2 text-base font-bold">
                        <span className="truncate">{teamName}</span>
                        <span className="text-sm font-normal text-ink-2">{list.length}</span>
                      </summary>
                      <ul className="pb-2 ps-3 text-sm">
                        {list.map((p) => (
                          <li key={p.team_member_id} className="py-0.5">
                            {p.name}
                            {!p.joined ? <span className="ms-1.5 text-xs text-ink-2">({c.notJoined})</span> : null}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>

        <Section title={c.members} aside={<span className="text-base font-bold text-ink-2">{ctx.members.length}</span>}>
          <ul className="divide-y divide-rule border-y border-rule">
            {ctx.members.map((m) => (
              <li key={m.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
                <span className="text-base font-bold">
                  {m.display_name}
                  {m.id === ctx.me?.id ? <span className="ms-1.5 text-xs font-normal text-ink-2">· {strings.common.you}</span> : null}
                </span>
                {m.is_admin ? <span className="text-xs font-bold">{c.admin}</span> : null}
              </li>
            ))}
          </ul>
          {ctx.isAdmin ? (
            <EditArea
              title={c.manageMembers}
              add={
                <ul className="flex flex-col gap-2">
                  {ctx.members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-bold">{m.display_name}</span>
                      <ActionButton action={setCompanyAdmin.bind(null, companyId, m.id, !m.is_admin)} variant="outline">
                        {m.is_admin ? c.removeAdmin : c.makeAdmin}
                      </ActionButton>
                    </li>
                  ))}
                </ul>
              }
              remove={
                <ul className="flex flex-col gap-2">
                  {ctx.members
                    .filter((m) => m.id !== ctx.me?.id)
                    .map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-bold">{m.display_name}</span>
                        <ActionButton
                          action={removeCompanyMember.bind(null, companyId, m.id)}
                          confirm={`${strings.common.remove}: ${m.display_name}?`}
                          label={`${strings.common.remove} ${m.display_name}`}
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

        <Section title={c.roles}>
          <ul className="flex flex-wrap gap-2">
            {ctx.roles.map((r) => (
              <li key={r.id} className="rounded-[var(--radius-cell)] border border-rule bg-paper px-3 py-2 text-base font-bold">
                {r.name}
              </li>
            ))}
          </ul>
          {ctx.canManage ? (
            <EditArea
              title={c.manageRoles}
              add={
                <ActionForm action={addCompanyRole.bind(null, companyId)} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Field label={strings.team.roleName} name="name" required maxLength={40} />
                  </div>
                  <SubmitButton variant="outline">{strings.team.addRole}</SubmitButton>
                </ActionForm>
              }
              remove={
                <ul className="flex flex-col gap-2">
                  {ctx.roles.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold">{r.name}</span>
                      <ActionButton
                        action={removeCompanyRole.bind(null, companyId, r.id)}
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

        {ctx.company.battalion_id ? (
          <Section title={strings.battalion.title}>
            <p className="text-base">{strings.battalion.companyLinked}</p>
            {ctx.isAdmin ? (
              <EditArea
                title={strings.battalion.leave}
                remove={
                  <ActionButton action={leaveBattalion.bind(null, companyId)} confirm={strings.battalion.confirmLeave} variant="danger">
                    {strings.battalion.leave}
                  </ActionButton>
                }
              />
            ) : null}
          </Section>
        ) : null}

        <Section title={c.invite}>
          <div className="rounded-[var(--radius-control)] border border-rule bg-paper p-4">
            <p dir="ltr" className="text-center text-[2rem] font-extrabold tracking-[0.2em]">
              {ctx.company.invite_code}
            </p>
            <p className="mt-2 text-sm text-ink-2">{c.inviteHint}</p>
            <div className="mt-4 flex flex-wrap items-start gap-2">
              <CopyButton text={inviteUrl}>{strings.team.copyLink}</CopyButton>
              {ctx.isAdmin ? (
                <ActionButton action={regenerateCompanyCode.bind(null, companyId)} variant="outline">
                  {strings.team.newCode}
                </ActionButton>
              ) : null}
            </div>
          </div>
        </Section>
      </main>
    </>
  );
}

export default function CompanyPage({ params }: PageProps<"/c/[companyId]">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Suspense fallback={<div aria-hidden className="h-36 bg-board" />}>
        <Company params={params} />
      </Suspense>
    </div>
  );
}

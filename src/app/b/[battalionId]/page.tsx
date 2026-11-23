import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Trash2 } from "lucide-react";
import { getBattalionContext, getBattalionDashboard, getBattalionStructure, type DashboardCompany, type StructureCompany } from "@/lib/battalion-data";
import { getMyAdminUnits, getMyPlaces } from "@/lib/places";
import { clock, dayLabel, shortDate, untilLabel, weekdayOf } from "@/lib/dates";
import { strings } from "@/lib/strings";
import { Section, TallyBar } from "@/components/section";
import { ActionForm, Field, SelectField, SubmitButton } from "@/components/ui";
import { ActionButton, CopyButton } from "@/components/action-button";
import { EditArea } from "@/components/edit-area";
import { AssignmentEditForm, EditRow, RoleEditForm } from "@/components/role-editing";
import { PlacesMenu } from "@/components/places-menu";
import {
  addBattalionAssignment,
  addBattalionRole,
  removeBattalionAssignment,
  removeBattalionRole,
  updateBattalionAssignment,
  updateBattalionRole,
  addMyCompanyToBattalion,
  createCompanyInBattalion,
  moveTeam,
  addCompanyToBattalion,
  regenerateBattalionCode,
  removeBattalionMember,
  removeCompanyFromBattalion,
  setBattalionAdmin,
} from "../actions";

const b = strings.battalion;

export const metadata = { title: b.dashboard };

function Totals({ companies }: { companies: DashboardCompany[] }) {
  const sum = (k: keyof DashboardCompany) => companies.reduce((n, c) => n + Number(c[k] ?? 0), 0);
  const items = [
    { label: b.totalCompanies, value: companies.length },
    { label: b.totalTeams, value: sum("teams") },
    { label: b.totalCadets, value: sum("roster") },
    { label: b.totalReported, value: `${sum("reported_teams")}/${sum("teams")}` },
  ];
  return (
    <dl className="grid grid-cols-4 gap-2 text-center">
      {items.map((i) => (
        <div key={i.label} className="rounded-[var(--radius-cell)] border border-rule bg-paper px-1 py-2">
          <dt className="text-xs text-ink-2">{i.label}</dt>
          <dd className="text-xl font-extrabold">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CompanyCard({ c }: { c: DashboardCompany }) {
  const counted = c.present + c.late + c.absent;
  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-extrabold">{c.company_name}</h3>
        <span className="text-sm text-ink-2">{b.teamsAndCadets(c.teams, c.roster)}</span>
      </div>
      {c.reported_teams > 0 ? (
        <div className="mt-1">
          <p className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-bold">{b.reported(c.reported_teams, c.teams)}</span>
            <span className="font-extrabold">{b.present(c.present, counted)}</span>
          </p>
          <div className="mt-1.5">
            <TallyBar present={c.present} late={c.late} total={counted} />
          </div>
          {c.late || c.absent ? (
            <p className="mt-1.5 flex gap-3 text-sm">
              {c.late ? <span className="font-bold text-now-ink">{b.late(c.late)}</span> : null}
              {c.absent ? <span className="font-bold text-absent-ink">{b.absent(c.absent)}</span> : null}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 text-sm text-ink-2">{b.noRollCall}</p>
      )}
      <p className="mt-2 flex flex-wrap gap-x-3 text-sm">
        <span className="font-bold">{strings.company.openTasks(c.open_tasks)}</span>
        {c.overdue_tasks > 0 ? <span className="font-bold text-absent-ink">{strings.company.overdue(c.overdue_tasks)}</span> : null}
      </p>
    </li>
  );
}

async function Battalion({ params }: { params: Promise<{ battalionId: string }> }) {
  const battalionId = Number((await params).battalionId);
  // Context first: a non-member gets "not found" before the dashboard's permission check runs.
  const ctx = await getBattalionContext(battalionId);
  const [companies, places, adminUnits, structure] = await Promise.all([
    getBattalionDashboard(battalionId),
    getMyPlaces(),
    getMyAdminUnits(),
    ctx.isAdmin ? getBattalionStructure(battalionId) : Promise.resolve([] as StructureCompany[]),
  ]);
  // Companies I admin that aren't in this battalion yet: one tap to add.
  const myOtherCompanies = adminUnits.companies.filter((x) => x.battalion_id !== battalionId);
  await connection();
  const now = new Date();
  const h = await headers();
  const inviteUrl = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/join?code=${ctx.battalion.invite_code}`;
  const assignments = [...ctx.onDuty, ...ctx.upcoming];
  // Cadets for the role picker, grouped by company · team.
  const peopleByTeam = [
    ...ctx.people.reduce(
      (map, p) => map.set(`${p.company_name} · ${p.team_name}`, [...(map.get(`${p.company_name} · ${p.team_name}`) ?? []), p]),
      new Map<string, typeof ctx.people>(),
    ),
  ];

  // Who can hold a role, for the add and edit forms.
  const personOptions = (
    <>
      {ctx.members.length ? (
        <optgroup label={b.staffGroup}>
          {ctx.members.map((m) => (
            <option key={m.id} value={`m:${m.id}`}>{m.display_name}</option>
          ))}
        </optgroup>
      ) : null}
      {peopleByTeam.map(([group, list]) => (
        <optgroup key={group} label={group}>
          {list.map((p) => (
            <option key={p.team_member_id} value={`t:${p.team_member_id}`}>{p.name}</option>
          ))}
        </optgroup>
      ))}
    </>
  );

  return (
    <>
      <header className="bg-board pb-4 pt-[max(env(safe-area-inset-top),1rem)] text-board-ink">
        <div className="mx-auto flex max-w-xl items-baseline justify-between gap-3 px-4">
          <div className="min-w-0">
            <p className="text-[1.375rem] font-extrabold leading-tight">{strings.app.name}</p>
            <PlacesMenu current={{ kind: "battalion", id: battalionId, name: ctx.battalion.name }} places={places} />
          </div>
          <p className="shrink-0 text-sm font-bold text-now">
            {dayLabel(now)} · {clock(now)}
          </p>
        </div>
        <div className="mx-auto max-w-xl px-4">
          {ctx.onDuty.length ? (
            <ul aria-label={b.onDuty} className="mt-3 border-t border-board-rule">
              {ctx.onDuty.map(({ a: x, role, member }) => (
                <li key={x.id} className="flex h-10 items-center gap-3 border-b border-board-2 text-[0.9375rem] last:border-b-0">
                  <span className="w-[6.5rem] truncate font-bold text-now">{role.name}</span>
                  <span className="flex-1 truncate">{member.name}{member.detail ? ` (${member.detail})` : ""}</span>
                  <span className="text-sm text-board-dim">{untilLabel(x.end_date, ctx.today)}</span>
                </li>
              ))}
            </ul>
          ) : ctx.roles.length ? (
            <p className="mt-3 border-t border-board-rule pt-3 text-base text-board-dim">{b.nobodyOnDuty}</p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 pt-4">
        <h1 className="sr-only">{b.dashboard}</h1>
        <Totals companies={companies} />

        <Section title={b.companies} aside={<span className="text-base font-bold text-ink-2">{companies.length}</span>}>
          {companies.length === 0 ? (
            <p className="text-base text-ink-2">{b.noCompanies}</p>
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {companies.map((c) => (
                <CompanyCard key={c.company_id} c={c} />
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-ink-2">{b.countsOnly}</p>
          {ctx.isAdmin ? (
            <EditArea
              title={b.manageCompanies}
              add={
                <div className="flex flex-col gap-5">
                  {myOtherCompanies.length ? (
                    <div>
                      <p className="text-sm font-bold">{b.myCompanies}</p>
                      <p className="text-xs text-ink-2">{b.myCompaniesHint}</p>
                      <ul className="mt-2 flex flex-col gap-2">
                        {myOtherCompanies.map((x) => (
                          <li key={x.id} className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate text-sm font-bold">
                              {x.name}
                              {x.battalion_id ? <span className="ms-1.5 text-xs font-normal text-ink-2">({b.inOtherBattalion})</span> : null}
                            </span>
                            <ActionButton action={addMyCompanyToBattalion.bind(null, battalionId, x.id)} variant="outline">
                              {b.addThis}
                            </ActionButton>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <ActionForm action={createCompanyInBattalion.bind(null, battalionId)} className="flex flex-col gap-2">
                    <p className="text-sm font-bold">{b.newCompanyInBattalion}</p>
                    <p className="text-xs text-ink-2">{b.newCompanyHint}</p>
                    <Field label={strings.company.createName} name="name" required maxLength={60} />
                    <Field label={strings.company.displayName} name="display_name" required maxLength={60} autoComplete="name" />
                    <SubmitButton variant="outline">{b.newCompanyInBattalion}</SubmitButton>
                  </ActionForm>

                  <details>
                    <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold underline">{b.withCode}</summary>
                    <ActionForm action={addCompanyToBattalion.bind(null, battalionId)} className="mt-2 flex flex-col gap-2">
                      <p className="text-sm text-ink-2">{b.addCompanyHint}</p>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Field
                            label={b.companyCode}
                            name="code"
                            required
                            dir="ltr"
                            maxLength={8}
                            autoCapitalize="characters"
                            autoComplete="off"
                            className="tracking-[0.2em] uppercase"
                          />
                        </div>
                        <SubmitButton variant="outline">{b.addCompany}</SubmitButton>
                      </div>
                    </ActionForm>
                  </details>
                </div>
              }
              remove={
                companies.length ? (
                  <ul className="flex flex-col gap-2">
                    {companies.map((c) => (
                      <li key={c.company_id} className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-bold">{c.company_name}</span>
                        <ActionButton
                          action={removeCompanyFromBattalion.bind(null, battalionId, c.company_id)}
                          confirm={b.confirmRemoveCompany(c.company_name)}
                          label={`${strings.common.remove} ${c.company_name}`}
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

        {ctx.isAdmin && structure.length > 1 ? (
          <Section title={b.structure}>
            <p className="mb-2 text-sm text-ink-2">{b.structureHint}</p>
            <ul className="divide-y divide-rule border-y border-rule">
              {structure.map((co) => (
                <li key={co.company_id} className="py-2.5">
                  <p className="text-base font-extrabold">{co.company_name}</p>
                  {co.teams.length === 0 ? (
                    <p className="text-sm text-ink-2">{b.noTeamsInCompany}</p>
                  ) : (
                    <ul className="mt-1 flex flex-col gap-2">
                      {co.teams.map((tm) => (
                        <li key={tm.team_id}>
                          <ActionForm action={moveTeam.bind(null, battalionId, tm.team_id)} className="flex items-end gap-2">
                            <span className="min-w-0 flex-1 truncate pb-3 text-sm font-bold">{tm.team_name}</span>
                            <div className="w-40">
                              <SelectField label={b.moveTo} name="company_id" required defaultValue="">
                                <option value="" disabled>—</option>
                                {structure
                                  .filter((other) => other.company_id !== co.company_id)
                                  .map((other) => (
                                    <option key={other.company_id} value={other.company_id}>{other.company_name}</option>
                                  ))}
                              </SelectField>
                            </div>
                            <SubmitButton variant="outline">{b.move}</SubmitButton>
                          </ActionForm>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section title={b.assignments}>
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
          {ctx.canManage && ctx.roles.length ? (
            <EditArea
              title={b.manageAssignments}
              add={
                <ActionForm action={addBattalionAssignment.bind(null, battalionId)} className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <SelectField label={strings.team.role} name="role_id" required defaultValue="">
                      <option value="" disabled>—</option>
                      {ctx.roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </SelectField>
                    <SelectField label={strings.team.member} name="person" required defaultValue="">
                      <option value="" disabled>—</option>
                      {personOptions}
                    </SelectField>
                    <Field label={strings.team.from} name="start_date" type="date" required defaultValue={ctx.today} />
                    <Field label={strings.team.to} name="end_date" type="date" required defaultValue={ctx.today} />
                  </div>
                  <SubmitButton variant="outline">{strings.team.assign}</SubmitButton>
                </ActionForm>
              }
              remove={
                assignments.length ? (
                  <ul className="flex flex-col gap-1">
                    {assignments.map(({ a: x, role, member }) => (
                      <EditRow
                        key={x.id}
                        editLabel={strings.roleEditing.editAssignment(role.name, member.name)}
                        summary={
                          <>
                            <span className="font-bold">{role.name}</span> · {member.name} · {shortDate(x.start_date)}
                            {x.end_date !== x.start_date ? `–${shortDate(x.end_date)}` : ""}
                          </>
                        }
                        remove={
                          <ActionButton
                            action={removeBattalionAssignment.bind(null, battalionId, x.id)}
                            label={`${strings.common.remove} ${role.name} ${member.name}`}
                            variant="icon-danger"
                          >
                            <Trash2 aria-hidden size={18} />
                          </ActionButton>
                        }
                      >
                        <AssignmentEditForm
                          action={updateBattalionAssignment.bind(null, battalionId, x.id)}
                          roles={ctx.roles}
                          roleId={role.id}
                          personName="person"
                          personDefault={x.member_id ? `m:${x.member_id}` : `t:${x.team_member_id}`}
                          personOptions={personOptions}
                          start={x.start_date}
                          end={x.end_date}
                        />
                      </EditRow>
                    ))}
                  </ul>
                ) : null
              }
            />
          ) : null}
        </Section>

        <Section title={b.roles}>
          {ctx.roles.length ? (
            <ul className="flex flex-wrap gap-2">
              {ctx.roles.map((r) => (
                <li key={r.id} className="rounded-[var(--radius-cell)] border border-rule bg-paper px-3 py-2 text-base font-bold">
                  {r.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-ink-2">{b.noRoles}</p>
          )}
          {ctx.canManage ? (
            <>
              <p className="mt-2 text-xs text-ink-2">{b.rolesHint}</p>
              <EditArea
                title={b.manageRoles}
                add={
                  <ActionForm action={addBattalionRole.bind(null, battalionId)} className="flex items-end gap-2">
                    <div className="flex-1">
                      <Field label={strings.team.roleName} name="name" required maxLength={40} />
                    </div>
                    <SubmitButton variant="outline">{strings.team.addRole}</SubmitButton>
                  </ActionForm>
                }
                remove={
                  ctx.roles.length ? (
                    <ul className="flex flex-col gap-1">
                      {ctx.roles.map((r) => (
                        <EditRow
                          key={r.id}
                          editLabel={strings.roleEditing.editRole(r.name)}
                          summary={<span className="font-bold">{r.name}</span>}
                          remove={
                            <ActionButton
                              action={removeBattalionRole.bind(null, battalionId, r.id)}
                              confirm={`${strings.common.remove}: ${r.name}?`}
                              label={`${strings.common.remove} ${r.name}`}
                              variant="icon-danger"
                            >
                              <Trash2 aria-hidden size={18} />
                            </ActionButton>
                          }
                        >
                          <RoleEditForm action={updateBattalionRole.bind(null, battalionId, r.id)} name={r.name} isCommand={r.is_command} />
                        </EditRow>
                      ))}
                    </ul>
                  ) : null
                }
              />
            </>
          ) : null}
        </Section>

        <Section title={b.members} aside={<span className="text-base font-bold text-ink-2">{ctx.members.length}</span>}>
          <ul className="divide-y divide-rule border-y border-rule">
            {ctx.members.map((m) => (
              <li key={m.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
                <span className="text-base font-bold">
                  {m.display_name}
                  {m.id === ctx.me?.id ? <span className="ms-1.5 text-xs font-normal text-ink-2">· {strings.common.you}</span> : null}
                </span>
                {m.is_admin ? <span className="text-xs font-bold">{strings.company.admin}</span> : null}
              </li>
            ))}
          </ul>
          {ctx.isAdmin ? (
            <EditArea
              title={b.manageMembers}
              add={
                <ul className="flex flex-col gap-2">
                  {ctx.members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-bold">{m.display_name}</span>
                      <ActionButton action={setBattalionAdmin.bind(null, battalionId, m.id, !m.is_admin)} variant="outline">
                        {m.is_admin ? b.removeAdmin : b.makeAdmin}
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
                          action={removeBattalionMember.bind(null, battalionId, m.id)}
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

        {ctx.me ? (
        <Section title={b.invite}>
          <div className="rounded-[var(--radius-control)] border border-rule bg-paper p-4">
            <p dir="ltr" className="text-center text-[2rem] font-extrabold tracking-[0.2em]">
              {ctx.battalion.invite_code}
            </p>
            <p className="mt-2 text-sm text-ink-2">{b.inviteHint}</p>
            <div className="mt-4 flex flex-wrap items-start gap-2">
              <CopyButton text={inviteUrl}>{strings.team.copyLink}</CopyButton>
              {ctx.isAdmin ? (
                <ActionButton action={regenerateBattalionCode.bind(null, battalionId)} variant="outline">
                  {strings.team.newCode}
                </ActionButton>
              ) : null}
            </div>
          </div>
        </Section>
        ) : null}
      </main>
    </>
  );
}

export default function BattalionPage({ params }: PageProps<"/b/[battalionId]">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Suspense fallback={<p className="px-4 py-8 text-ink-2">{strings.common.loading}</p>}>
        <Battalion params={params} />
      </Suspense>
    </div>
  );
}

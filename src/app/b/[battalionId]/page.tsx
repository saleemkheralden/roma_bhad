import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Trash2 } from "lucide-react";
import { getBattalionContext, getBattalionDashboard, type DashboardCompany } from "@/lib/battalion-data";
import { getMyPlaces } from "@/lib/places";
import { clock, dayLabel } from "@/lib/dates";
import { strings } from "@/lib/strings";
import { Section, TallyBar } from "@/components/section";
import { ActionForm, Field, SubmitButton } from "@/components/ui";
import { ActionButton, CopyButton } from "@/components/action-button";
import { EditArea } from "@/components/edit-area";
import { PlacesMenu } from "@/components/places-menu";
import {
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
  const [companies, places] = await Promise.all([getBattalionDashboard(battalionId), getMyPlaces()]);
  await connection();
  const now = new Date();
  const h = await headers();
  const inviteUrl = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/join?code=${ctx.battalion.invite_code}`;

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
                <ActionForm action={addCompanyToBattalion.bind(null, battalionId)} className="flex flex-col gap-2">
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

import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ExternalLink, Sheet, Trash2 } from "lucide-react";
import { getLinks, getSheets, getTeamContext, type LinkRow } from "@/lib/data";
import { romaAccountEmail } from "@/lib/google-auth";
import { strings } from "@/lib/strings";
import { Section } from "@/components/section";
import { ActionForm, Field, SubmitButton } from "@/components/ui";
import { ActionButton, CopyButton } from "@/components/action-button";
import { EditArea } from "@/components/edit-area";
import { addLink, addSheet, removeIntegration, removeLink } from "../actions";

const s = strings.links;

async function Links({ params }: { params: Promise<{ teamId: string }> }) {
  const teamId = Number((await params).teamId);
  const [ctx, links, sheets] = await Promise.all([getTeamContext(teamId), getLinks(teamId), getSheets(teamId)]);
  const canManage = ctx.permissions.can_manage;
  const sh = strings.sheets;
  const romaAccount = romaAccountEmail();

  const groups = new Map<string, LinkRow[]>();
  for (const l of links) {
    const key = l.category || s.other;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }

  return (
    <>
      <h1 className="sr-only">{s.title}</h1>

      {sheets.length > 0 || canManage ? (
        <Section title={sh.title}>
          {sheets.length === 0 ? (
            <p className="text-base text-ink-2">{sh.empty}</p>
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {sheets.map((x) => (
                <li key={x.id}>
                  <Link
                    href={`/t/${teamId}/links/sheets/${x.id}`}
                    className="flex min-h-12 items-center justify-between gap-3 py-1.5 text-base font-medium hover:bg-paper"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Sheet aria-hidden size={18} className="shrink-0 text-ink-2" />
                      <span className="truncate">{x.label || sh.title}</span>
                    </span>
                    <ChevronLeft aria-hidden size={18} className="shrink-0 text-ink-2" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {canManage ? (
            <EditArea
              title={sh.connect}
              add={
                romaAccount ? (
                  <ActionForm action={addSheet.bind(null, teamId)} className="flex flex-col gap-3">
                    <ol className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-rule bg-paper p-3 text-sm">
                      <li>
                        <span className="font-bold">1. </span>
                        {sh.step1}
                        <span dir="ltr" className="mt-1 block break-all text-start font-bold">{romaAccount}</span>
                        <span className="mt-2 block">
                          <CopyButton text={romaAccount}>{strings.calendar.copyEmail}</CopyButton>
                        </span>
                      </li>
                      <li>
                        <span className="font-bold">2. </span>
                        {sh.step2}
                      </li>
                    </ol>
                    <Field label={sh.field} name="sheet" placeholder={sh.placeholder} dir="ltr" required maxLength={2000} />
                    <Field label={sh.range} hint={sh.rangeHint} name="range" placeholder="A1:F40" dir="ltr" maxLength={20} />
                    <Field label={sh.label} name="label" maxLength={60} />
                    <p className="rounded-[var(--radius-cell)] bg-now-wash px-3 py-2 text-sm font-medium text-now-ink">
                      {sh.securityNote}
                    </p>
                    <SubmitButton variant="outline">{sh.connect}</SubmitButton>
                  </ActionForm>
                ) : (
                  <p className="text-sm text-ink-2">{sh.notConnectedYet}</p>
                )
              }
              remove={
                sheets.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {sheets.map((x) => (
                      <li key={x.id} className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-bold">{x.label || sh.title}</span>
                        <ActionButton
                          action={removeIntegration.bind(null, teamId, x.id)}
                          confirm={`${strings.common.remove}: ${x.label || sh.title}?`}
                          label={`${strings.common.remove} ${x.label || sh.title}`}
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
      ) : null}
      {links.length === 0 ? <p className="mt-8 text-base text-ink-2">{s.empty}</p> : null}

      {[...groups.entries()].map(([category, items]) => (
        <Section key={category} title={category}>
          <ul className="divide-y divide-rule border-y border-rule">
            {items.map((l) => (
              <li key={l.id}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center justify-between gap-3 py-1.5 text-base font-medium hover:bg-paper"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{l.title}</span>
                    <span dir="ltr" className="block truncate text-start text-xs text-ink-2">
                      {l.url.replace(/^https?:\/\//, "")}
                    </span>
                  </span>
                  <ExternalLink aria-hidden size={18} className="shrink-0 text-ink-2" />
                </a>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      {canManage ? (
        <Section title={s.add}>
          <ActionForm action={addLink.bind(null, teamId)} className="flex flex-col gap-3">
            <Field label={s.linkTitle} name="title" required maxLength={60} />
            <Field label={s.url} name="url" type="url" inputMode="url" required dir="ltr" maxLength={2000} />
            <Field label={s.category} name="category" maxLength={30} />
            <SubmitButton variant="outline">{s.add}</SubmitButton>
          </ActionForm>
          {links.length > 0 ? (
            <EditArea
              title={s.manage}
              remove={
                <ul className="flex flex-col gap-2">
                  {links.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-bold">{l.title}</span>
                      <ActionButton
                        action={removeLink.bind(null, teamId, l.id)}
                        confirm={`${strings.common.remove}: ${l.title}?`}
                        label={`${strings.common.remove} ${l.title}`}
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
      ) : null}
    </>
  );
}

export default function LinksPage({ params }: PageProps<"/t/[teamId]/links">) {
  return (
    <Suspense fallback={<p className="text-ink-2">{strings.common.loading}</p>}>
      <Links params={params} />
    </Suspense>
  );
}

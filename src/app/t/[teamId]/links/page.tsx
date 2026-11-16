import { Suspense } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { getLinks, getTeamContext, type LinkRow } from "@/lib/data";
import { strings } from "@/lib/strings";
import { Section } from "@/components/section";
import { ActionForm, Field, SubmitButton } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { EditArea } from "@/components/edit-area";
import { addLink, removeLink } from "../actions";

const s = strings.links;

async function Links({ params }: { params: Promise<{ teamId: string }> }) {
  const teamId = Number((await params).teamId);
  const [ctx, links] = await Promise.all([getTeamContext(teamId), getLinks(teamId)]);
  const canManage = ctx.permissions.can_manage;

  const groups = new Map<string, LinkRow[]>();
  for (const l of links) {
    const key = l.category || s.other;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }

  return (
    <>
      <h1 className="sr-only">{s.title}</h1>
      {links.length === 0 ? <p className="text-base text-ink-2">{s.empty}</p> : null}

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

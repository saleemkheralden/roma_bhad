import { Suspense } from "react";
import Link from "next/link";
import { strings } from "@/lib/strings";
import { ActionForm, Field, SubmitButton } from "@/components/ui";
import { buttonClass } from "@/components/button-class";
import { BoardHeader } from "@/components/board";
import { createTeam } from "../actions";
import { createCompany } from "../c/actions";
import { createBattalion } from "../b/actions";

const s = strings.create;
const co = strings.company;
const bt = strings.battalion;

export const metadata = { title: s.chooseTitle };

type Kind = "team" | "company" | "battalion";

/** What to open: a team (cadets join it), or a company (staff set it up and add teams). */
async function NewBody({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const type = (await searchParams).type;
  const kind: Kind = type === "company" || type === "battalion" ? type : "team";
  const options: { kind: Kind; label: string; hint: string }[] = [
    { kind: "team", label: s.team, hint: s.teamHint },
    { kind: "company", label: s.company, hint: s.companyHint },
    { kind: "battalion", label: s.battalion, hint: s.battalionHint },
  ];

  return (
    <>
      <div role="tablist" aria-label={s.chooseTitle} className="mb-6 grid grid-cols-3 gap-2">
        {options.map((o) => (
          <Link
            key={o.kind}
            role="tab"
            aria-selected={kind === o.kind}
            href={o.kind === "team" ? "/new" : `/new?type=${o.kind}`}
            replace
            className={buttonClass(kind === o.kind ? "primary" : "outline")}
          >
            {o.label}
          </Link>
        ))}
      </div>
      <p className="mb-4 text-sm text-ink-2">{options.find((o) => o.kind === kind)?.hint}</p>

      {kind === "team" ? (
        <ActionForm action={createTeam} className="flex flex-col gap-4">
          <Field label={s.teamName} name="name" placeholder={s.teamNameHint} required maxLength={60} />
          <Field label={s.yourFirstName} name="first_name" required maxLength={40} autoComplete="given-name" />
          <Field label={s.yourLastName} name="last_name" maxLength={40} autoComplete="family-name" />
          <p className="text-sm text-ink-2">{s.note}</p>
          <SubmitButton>{s.submit}</SubmitButton>
        </ActionForm>
      ) : kind === "battalion" ? (
        <ActionForm action={createBattalion} className="flex flex-col gap-4">
          <Field label={bt.createName} name="name" placeholder={bt.createNameHint} required maxLength={60} />
          <Field label={bt.displayName} name="display_name" required maxLength={60} autoComplete="name" />
          <p className="text-sm text-ink-2">{s.battalionNote}</p>
          <SubmitButton>{bt.create}</SubmitButton>
        </ActionForm>
      ) : (
        <ActionForm action={createCompany} className="flex flex-col gap-4">
          <Field label={co.createName} name="name" placeholder={co.createNameHint} required maxLength={60} />
          <Field label={co.displayName} name="display_name" required maxLength={60} autoComplete="name" />
          <p className="text-sm text-ink-2">{s.companyNote}</p>
          <SubmitButton>{co.create}</SubmitButton>
        </ActionForm>
      )}
    </>
  );
}

export default function NewPage({ searchParams }: PageProps<"/new">) {
  return (
    <main className="flex min-h-dvh flex-col">
      <BoardHeader />
      <section className="mx-auto w-full max-w-md px-4 py-8">
        <h1 className="mb-6 text-2xl font-extrabold">{s.chooseTitle}</h1>
        <Suspense fallback={<p className="text-ink-2">{strings.common.loading}</p>}>
          <NewBody searchParams={searchParams as Promise<{ type?: string }>} />
        </Suspense>
        <Link href="/" className={buttonClass("quiet", "mt-4")}>
          {strings.common.back}
        </Link>
      </section>
    </main>
  );
}

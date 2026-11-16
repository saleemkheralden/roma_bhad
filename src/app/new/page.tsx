import Link from "next/link";
import { strings } from "@/lib/strings";
import { ActionForm, Field, SubmitButton } from "@/components/ui";
import { buttonClass } from "@/components/button-class";
import { BoardHeader } from "@/components/board";
import { createTeam } from "../actions";

const s = strings.create;

export const metadata = { title: s.title };

export default function NewTeamPage() {
  return (
    <main className="flex min-h-dvh flex-col">
      <BoardHeader />
      <section className="mx-auto w-full max-w-md px-4 py-8">
        <h1 className="mb-6 text-2xl font-extrabold">{s.title}</h1>
        <ActionForm action={createTeam} className="flex flex-col gap-4">
          <Field label={s.teamName} name="name" placeholder={s.teamNameHint} required maxLength={60} />
          <Field label={s.yourFirstName} name="first_name" required maxLength={40} autoComplete="given-name" />
          <Field label={s.yourLastName} name="last_name" maxLength={40} autoComplete="family-name" />
          <p className="text-sm text-ink-2">{s.note}</p>
          <SubmitButton>{s.submit}</SubmitButton>
        </ActionForm>
        <Link href="/" className={buttonClass("quiet", "mt-4")}>
          {strings.common.back}
        </Link>
      </section>
    </main>
  );
}

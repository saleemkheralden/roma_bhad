import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { strings } from "@/lib/strings";
import { ActionForm, Field } from "@/components/ui";
import { buttonClass } from "@/components/button-class";
import { BoardHeader } from "@/components/board";
import { joinTeam } from "../actions";
import { ClaimPicker } from "./claim-picker";

const s = strings.join;

export const metadata = { title: s.title };

type Preview = {
  team_id: number;
  team_name: string;
  already_member: boolean;
  unclaimed: { id: number; first_name: string; last_name: string }[];
} | null;

async function JoinBody({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const code = ((await searchParams).code ?? "").trim().toUpperCase();

  if (!code) {
    return (
      <form method="get" className="flex flex-col gap-4">
        <Field
          label={s.codeLabel}
          name="code"
          hint={s.codeHint}
          required
          autoCapitalize="characters"
          autoComplete="off"
          dir="ltr"
          maxLength={8}
          className="text-center text-xl tracking-[0.2em] uppercase"
        />
        <button className={buttonClass("primary")}>{s.find}</button>
      </form>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("preview_team", { p_code: code });
  const preview = data as unknown as Preview;

  if (!preview) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-[var(--radius-cell)] bg-absent-wash px-3 py-2 font-medium text-absent-ink">{s.notFound}</p>
        <Link href="/join" className={buttonClass("outline")}>
          {strings.common.back}
        </Link>
      </div>
    );
  }

  if (preview.already_member) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-lg font-bold">{preview.team_name}</p>
        <p className="text-ink-2">{s.alreadyMember}</p>
        <Link href={`/t/${preview.team_id}`} className={buttonClass("primary")}>
          {s.open}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-2xl font-extrabold">{preview.team_name}</p>
      <ActionForm action={joinTeam} className="flex flex-col gap-4">
        <input type="hidden" name="code" value={code} />
        <ClaimPicker unclaimed={preview.unclaimed} />
      </ActionForm>
    </div>
  );
}

export default function JoinPage({ searchParams }: PageProps<"/join">) {
  return (
    <main className="flex min-h-dvh flex-col">
      <BoardHeader />
      <section className="mx-auto w-full max-w-md px-4 py-8">
        <h1 className="mb-6 text-2xl font-extrabold">{s.title}</h1>
        <Suspense fallback={<p className="text-ink-2">{strings.common.loading}</p>}>
          <JoinBody searchParams={searchParams as Promise<{ code?: string }>} />
        </Suspense>
      </section>
    </main>
  );
}


import { Suspense } from "react";
import Link from "next/link";
import { getTeamContext } from "@/lib/data";
import { strings } from "@/lib/strings";
import { NameTrainer } from "./trainer";

const n = strings.names;

async function Names({ params }: { params: Promise<{ teamId: string }> }) {
  const teamId = Number((await params).teamId);
  const ctx = await getTeamContext(teamId);
  const people = ctx.roster
    .filter((m) => m.id !== ctx.me?.id)
    .map((m) => ({ id: m.id, first_name: m.first_name, last_name: m.last_name, nickname: m.nickname }));

  return (
    <>
      <div className="mb-4 flex items-end justify-between gap-3">
        <h1 className="text-xl font-extrabold">{n.title}</h1>
        <Link href={`/t/${teamId}/team`} className="inline-flex min-h-11 items-center text-sm font-bold underline">
          {strings.common.back}
        </Link>
      </div>
      <p className="mb-4 text-sm text-ink-2">{n.intro}</p>
      <NameTrainer teamId={teamId} people={people} />
    </>
  );
}

export default function NamesPage({ params }: PageProps<"/t/[teamId]/team/names">) {
  return (
    <Suspense fallback={<p className="text-ink-2">{strings.common.loading}</p>}>
      <Names params={params} />
    </Suspense>
  );
}

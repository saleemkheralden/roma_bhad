import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyPlaces, homeFor } from "@/lib/places";
import { strings } from "@/lib/strings";
import { buttonClass } from "@/components/button-class";
import { BoardHeader } from "@/components/board";

const s = strings.onboarding;

async function HomeRedirect() {
  // Reopen the last place (team, company or battalion) the user was in.
  const home = await homeFor(await getMyPlaces());
  if (home) redirect(home);
  return (
    <section className="mx-auto w-full max-w-md px-4 py-8">
      <h1 className="text-2xl font-extrabold">{s.title}</h1>
      <p className="mt-2 text-base text-ink-2">{s.subtitle}</p>
      <div className="mt-8 flex flex-col gap-3">
        <Link href="/join" className={buttonClass("primary")}>
          {s.join}
        </Link>
        <Link href="/new" className={buttonClass("outline")}>
          {s.create}
        </Link>
      </div>
      <form action="/auth/signout" method="post" className="mt-10">
        <button className={buttonClass("quiet")}>{strings.common.signOut}</button>
      </form>
    </section>
  );
}

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col">
      <BoardHeader />
      <Suspense fallback={<p className="px-4 py-8 text-ink-2">{strings.common.loading}</p>}>
        <HomeRedirect />
      </Suspense>
    </main>
  );
}

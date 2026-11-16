import { Suspense } from "react";
import { strings } from "@/lib/strings";
import { LoginForm } from "./login-form";

export const metadata = { title: strings.login.title };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="bg-board px-4 pb-8 pt-[max(env(safe-area-inset-top),2.5rem)] text-board-ink">
        <p className="text-[2.5rem] font-extrabold leading-none">{strings.app.name}</p>
        <p className="mt-2 text-base text-board-dim">{strings.login.subtitle}</p>
      </header>
      <section className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-extrabold">{strings.login.title}</h1>
        <Suspense>
          {/* Email sign-in sends mail through Supabase: off unless EMAIL_LOGIN=on (needs custom SMTP online). */}
          <LoginForm emailEnabled={process.env.EMAIL_LOGIN === "on"} />
        </Suspense>
      </section>
    </main>
  );
}

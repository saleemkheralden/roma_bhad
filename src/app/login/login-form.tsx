"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { strings } from "@/lib/strings";
import { Button, Field, ErrorText } from "@/components/ui";

const s = strings.login;

function safeNext(next: string | null) {
  // Only same-site relative paths, never "//host" or absolute URLs.
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/** emailEnabled: local development only (EMAIL_LOGIN=on); production signs in with Google only. */
export function LoginForm({ emailEnabled }: { emailEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error") ? s.googleFailed : null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      // Hosted free projects send Supabase's default email (a link, no code): the link
      // lands on /auth/callback. Locally (and with custom SMTP) the email carries the code.
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (error) setError(s.sendFailed);
    else setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setBusy(false);
      setError(s.badCode);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function google() {
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) setError(s.googleFailed);
  }

  if (step === "code") {
    return (
      <form onSubmit={verify} className="flex flex-col gap-4">
        <p className="text-base text-ink-2">{s.codeSent(email.trim())}</p>
        <Field
          label={s.code}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          dir="ltr"
          className="text-center text-2xl tracking-[0.3em]"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy || code.length !== 6}>
          {busy ? strings.common.loading : s.verify}
        </Button>
        <button
          type="button"
          className="h-11 self-start text-base font-medium text-ink-2 underline"
          onClick={() => {
            setStep("email");
            setCode("");
            setError(null);
          }}
        >
          {s.otherEmail}
        </button>
      </form>
    );
  }

  if (!emailEnabled) {
    return (
      <div className="flex flex-col gap-4">
        <Button type="button" onClick={google}>
          {s.google}
        </Button>
        <ErrorText>{error}</ErrorText>
        <p className="text-sm text-ink-2">{s.googleOnly}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Button type="button" variant="outline" onClick={google}>
        {s.google}
      </Button>
      <div className="flex items-center gap-3 text-sm text-ink-2">
        <span className="h-px flex-1 bg-rule" />
        {s.or}
        <span className="h-px flex-1 bg-rule" />
      </div>
      <form onSubmit={sendCode} className="flex flex-col gap-4">
        <Field
          label={s.email}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy || !email.trim()}>
          {busy ? strings.common.loading : s.sendCode}
        </Button>
      </form>
    </div>
  );
}

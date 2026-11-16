"use client";

import { useState, useTransition, type ReactNode } from "react";
import { strings } from "@/lib/strings";
import { buttonClass, type ButtonVariant } from "./button-class";
import type { ActionResult } from "./ui";

/** Runs a bound server function on click; optional confirm; shows its error inline. */
export function ActionButton({
  action,
  children,
  variant = "quiet",
  confirm,
  className = "",
  label,
}: {
  action: () => Promise<ActionResult>;
  children: ReactNode;
  variant?: ButtonVariant;
  confirm?: string;
  className?: string;
  label?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        aria-label={label}
        disabled={pending}
        className={buttonClass(variant, className)}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setError(null);
          start(async () => {
            const result = await action();
            if (result?.error) setError(result.error);
          });
        }}
      >
        {pending ? strings.common.loading : children}
      </button>
      {error ? (
        <span role="alert" className="text-xs font-medium text-absent-ink">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/** Copies text to the clipboard and confirms. */
export function CopyButton({ text, children }: { text: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass("primary")}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? strings.common.copied : children}
    </button>
  );
}

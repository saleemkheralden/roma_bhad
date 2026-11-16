"use client";

import { useActionState, useId, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { strings } from "@/lib/strings";
import { buttonClass, type ButtonVariant } from "./button-class";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

/** Submit button that shows the pending state of its enclosing form. */
export function SubmitButton({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      className={buttonClass(variant, className)}
      {...props}
    >
      {pending ? strings.common.loading : children}
    </button>
  );
}

export function Field({
  label,
  hint,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-ink">
        {label}
      </label>
      <input
        id={id}
        className={`h-12 rounded-[var(--radius-control)] border border-rule-strong bg-paper px-3 text-ink placeholder:text-ink-2 focus:border-board focus:outline-none ${className || "text-base"}`}
        {...props}
      />
      {hint ? <p className="text-sm text-ink-2">{hint}</p> : null}
    </div>
  );
}

export function SelectField({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-ink">
        {label}
      </label>
      <select
        id={id}
        className="h-12 rounded-[var(--radius-control)] border border-rule-strong bg-paper px-3 text-base text-ink focus:border-board focus:outline-none"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-[var(--radius-cell)] bg-absent-wash px-3 py-2 text-sm font-medium text-absent-ink">
      {children}
    </p>
  );
}

export type ActionResult = { error?: string; ok?: boolean } | null;
export type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

/** A <form> bound to a server function, showing its error and resetting on success. */
export function ActionForm({
  action,
  children,
  className = "",
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <ErrorText>{state?.error}</ErrorText>
    </form>
  );
}

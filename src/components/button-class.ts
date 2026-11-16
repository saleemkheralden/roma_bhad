// Shared by server and client components (no "use client" here).
// Size and padding live only in the variants, so no two classes fight over them.
export type ButtonVariant = "primary" | "outline" | "quiet" | "danger" | "icon" | "icon-danger";

const buttonBase =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const buttonVariants: Record<ButtonVariant, string> = {
  primary: "h-12 px-5 bg-board text-board-ink hover:bg-board-2",
  outline: "h-12 px-5 border border-ink bg-paper text-ink hover:bg-ground",
  quiet: "h-11 px-3 text-ink-2 hover:bg-paper hover:text-ink",
  danger: "h-12 px-5 border border-absent bg-paper text-absent-ink hover:bg-absent-wash",
  icon: "size-11 text-ink-2 hover:bg-ground hover:text-ink",
  "icon-danger": "size-11 text-absent-ink hover:bg-absent-wash",
};

export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
  return `${buttonBase} ${buttonVariants[variant]} ${extra}`;
}

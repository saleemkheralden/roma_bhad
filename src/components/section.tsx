import type { ReactNode } from "react";

/** A titled block on the working ground. More space above the heading than below. */
export function Section({
  title,
  aside,
  children,
  id,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="mt-8 scroll-mt-4 first:mt-0">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-xl font-extrabold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Fixed-scale bar so every roll call compares at the same size. */
export function TallyBar({ present, late, total }: { present: number; late: number; total: number }) {
  const pct = (n: number) => (total ? (n / total) * 100 : 0);
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-rule" aria-hidden>
      <i className="block bg-present" style={{ width: `${pct(present)}%` }} />
      <i className="block bg-now" style={{ width: `${pct(late)}%` }} />
    </div>
  );
}

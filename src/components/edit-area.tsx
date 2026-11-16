import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** A collapsed edit area: adding first, deleting set apart below a rule. */
export function EditArea({ title, add, remove }: { title: string; add?: ReactNode; remove?: ReactNode }) {
  return (
    <details className="group mt-3">
      <summary className="flex h-11 cursor-pointer list-none items-center gap-1 text-sm font-bold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown aria-hidden size={18} className="transition-transform group-open:rotate-180" />
      </summary>
      {add ? <div className="pt-2">{add}</div> : null}
      {remove ? <div className="mt-6 border-t border-rule pt-4">{remove}</div> : null}
    </details>
  );
}

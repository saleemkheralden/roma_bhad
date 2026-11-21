import { Trash2 } from "lucide-react";
import { fullName, type HandoverNote, type Member } from "@/lib/data";
import { clock } from "@/lib/dates";
import { strings } from "@/lib/strings";
import { Section } from "@/components/section";
import { ActionButton } from "@/components/action-button";
import { EditArea } from "@/components/edit-area";
import { ActionForm, SubmitButton, TextArea } from "@/components/ui";
import { addHandoverNote, removeHandoverNote } from "./actions";

const h = strings.handover;

/**
 * Handover between role-holders: notes left for today on top, and for today's command
 * a place to write tomorrow's note. Hidden for cadets when there's nothing to read.
 */
export function Handover({
  notes,
  roster,
  today,
  tomorrow,
  teamId,
  canCommand,
  canManage,
  myUserId,
}: {
  notes: HandoverNote[];
  roster: Member[];
  today: string;
  tomorrow: string;
  teamId: number;
  canCommand: boolean;
  canManage: boolean;
  myUserId: string | null;
}) {
  const forToday = notes.filter((n) => n.for_date === today);
  const forTomorrow = notes.filter((n) => n.for_date === tomorrow);
  if (forToday.length === 0 && !canCommand) return null;

  const byId = new Map(roster.map((m) => [m.id, m]));
  const author = (n: HandoverNote) => {
    const m = n.author_member_id ? byId.get(n.author_member_id) : undefined;
    return m ? fullName(m) : h.unknownAuthor;
  };
  const list = (items: HandoverNote[]) => (
    <ul className="flex flex-col gap-2">
      {items.map((n) => (
        <li key={n.id} className="rounded-[var(--radius-control)] border border-rule bg-paper px-3 py-2.5">
          <p className="whitespace-pre-line text-base">{n.body}</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-xs text-ink-2">
              {h.by(author(n))} · <span dir="ltr">{clock(new Date(n.created_at))}</span>
            </p>
            {n.created_by === myUserId || canManage ? (
              <ActionButton
                action={removeHandoverNote.bind(null, teamId, n.id)}
                confirm={`${strings.common.remove}?`}
                label={strings.common.remove}
                variant="icon-danger"
              >
                <Trash2 aria-hidden size={18} />
              </ActionButton>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <Section title={h.title}>
      {canCommand ? <h3 className="mb-1 text-sm font-extrabold text-ink-2">{h.forToday}</h3> : null}
      {forToday.length === 0 ? <p className="text-base text-ink-2">{h.empty}</p> : list(forToday)}

      {canCommand ? (
        <>
          <h3 className="mb-1 mt-5 text-sm font-extrabold text-ink-2">{h.forTomorrow}</h3>
          {forTomorrow.length === 0 ? <p className="text-base text-ink-2">{h.noneTomorrow}</p> : list(forTomorrow)}
          <EditArea
            title={h.write}
            add={
              <ActionForm action={addHandoverNote.bind(null, teamId, tomorrow)} className="flex flex-col gap-2">
                <TextArea label={h.label} hint={h.hint} name="body" placeholder={h.placeholder} required maxLength={1000} />
                <SubmitButton variant="outline">{h.submit}</SubmitButton>
              </ActionForm>
            }
          />
        </>
      ) : null}
    </Section>
  );
}

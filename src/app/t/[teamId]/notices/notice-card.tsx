import { Pin, PinOff, Trash2 } from "lucide-react";
import { fullName, type Member, type Notice } from "@/lib/data";
import { clock, dayLabel, isoDate, shortDate } from "@/lib/dates";
import { strings } from "@/lib/strings";
import { ActionButton } from "@/components/action-button";
import { removeNotice, setNoticePinned, updateNotice } from "../actions";
import { EditNotice } from "./notice-form";
import { LinkedText } from "@/components/linked-text";

const s = strings.notices;

export type NoticeContext = {
  teamId: number;
  today: string;
  myUserId: string | null;
  canCommand: boolean;
  roster: Member[];
};

function author(n: Notice, roster: Member[]) {
  const m = n.created_by ? roster.find((r) => r.user_id === n.created_by) : null;
  return m ? fullName(m) : s.someone;
}

/** Time today, otherwise weekday + date, in Israel time. */
function when(ts: string, today: string) {
  const d = new Date(ts);
  return isoDate(d) === today ? clock(d) : dayLabel(d);
}

/** One notice. `compact` (the Today page) clamps the body and drops the controls. */
export function NoticeCard({
  notice: n,
  ctx,
  compact = false,
}: {
  notice: Notice;
  ctx: NoticeContext;
  compact?: boolean;
}) {
  const isNew = isoDate(new Date(n.created_at)) === ctx.today;
  const canEdit = !compact && (ctx.canCommand || (ctx.myUserId !== null && n.created_by === ctx.myUserId));
  const audience = n.audience === "command" ? "command" : "team";

  return (
    <article
      className={`rounded-[var(--radius-control)] border bg-paper px-4 py-3 ${
        n.pinned ? "border-board shadow-[inset_0_3px_0_var(--color-now)]" : "border-rule"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-extrabold">
        {n.pinned ? (
          <span className="inline-flex items-center gap-1 text-ink">
            <Pin aria-hidden size={14} className="fill-now text-ink" />
            {s.pinned}
          </span>
        ) : null}
        {audience === "command" ? (
          <span className="rounded-full bg-board px-2 py-0.5 text-board-ink">{s.commandTag}</span>
        ) : null}
        {isNew ? <span className="rounded-full bg-now-wash px-2 py-0.5 text-now-ink">{s.newTag}</span> : null}
      </div>
      <h3
        className={`text-lg font-extrabold leading-snug ${n.pinned || audience === "command" || isNew ? "mt-1" : ""}`}
      >
        {n.title}
      </h3>
      {n.body ? (
        <p className={`mt-1 whitespace-pre-line text-base text-ink ${compact ? "line-clamp-2" : ""}`}><LinkedText text={n.body} /></p>
      ) : null}
      <p className="mt-2 text-sm text-ink-2">
        {s.byline(author(n, ctx.roster), when(n.created_at, ctx.today))}
        {n.updated_at ? ` · ${s.edited}` : null}
        {n.expires_on ? ` · ${s.until(shortDate(n.expires_on))}` : null}
      </p>

      {canEdit ? (
        <div className="-mb-1 mt-2 flex flex-wrap items-start gap-1 border-t border-rule pt-1">
          <EditNotice
            action={updateNotice.bind(null, ctx.teamId, n.id)}
            title={n.title}
            body={n.body}
            audience={audience}
            expiresOn={n.expires_on}
            today={ctx.today}
          />
          {ctx.canCommand ? (
            <ActionButton
              action={setNoticePinned.bind(null, ctx.teamId, n.id, !n.pinned)}
              label={n.pinned ? s.unpinAction(n.title) : s.pinAction(n.title)}
              variant="icon"
            >
              {n.pinned ? <PinOff aria-hidden size={18} /> : <Pin aria-hidden size={18} />}
            </ActionButton>
          ) : null}
          <span className="ms-auto">
            <ActionButton
              action={removeNotice.bind(null, ctx.teamId, n.id)}
              confirm={s.confirmRemove(n.title)}
              label={s.remove(n.title)}
              variant="icon-danger"
            >
              <Trash2 aria-hidden size={18} />
            </ActionButton>
          </span>
        </div>
      ) : null}
    </article>
  );
}

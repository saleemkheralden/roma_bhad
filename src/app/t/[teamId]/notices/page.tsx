import { Suspense } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { getNotices, getTeamContext } from "@/lib/data";
import { strings } from "@/lib/strings";
import { Section } from "@/components/section";
import { postNotice } from "../actions";
import { NewNoticeForm } from "./notice-form";
import { NoticeCard, type NoticeContext } from "./notice-card";

const s = strings.notices;

async function Notices({ params }: { params: Promise<{ teamId: string }> }) {
  const teamId = Number((await params).teamId);
  const ctx = await getTeamContext(teamId);
  const notices = await getNotices(teamId, ctx.today);
  const canCommand = ctx.permissions.can_command;
  const noticeCtx: NoticeContext = {
    teamId,
    today: ctx.today,
    myUserId: ctx.me?.user_id ?? null,
    canCommand,
    roster: ctx.roster,
  };

  // RLS already hides handover notes from anyone who isn't a role-holder.
  const forTeam = notices.filter((n) => n.audience === "team");
  const forCommand = notices.filter((n) => n.audience === "command");

  return (
    <>
      <h1 className="sr-only">{s.title}</h1>

      {canCommand ? (
        <details className="group mb-6">
          <summary className="flex h-12 cursor-pointer list-none items-center justify-center gap-2 rounded-[var(--radius-control)] border border-ink bg-paper text-base font-bold hover:bg-ground [&::-webkit-details-marker]:hidden">
            <Plus aria-hidden size={20} />
            {s.new}
            <ChevronDown aria-hidden size={18} className="text-ink-2 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 rounded-[var(--radius-control)] border border-rule bg-paper p-4">
            <NewNoticeForm action={postNotice.bind(null, teamId)} today={ctx.today} />
          </div>
        </details>
      ) : null}

      {/* Own wrapper so the first section sits flush (Section uses first:mt-0). */}
      <div>
        {forCommand.length > 0 ? (
          <Section title={s.commandSection}>
            <ul className="flex flex-col gap-3">
              {forCommand.map((n) => (
                <li key={n.id}>
                  <NoticeCard notice={n} ctx={noticeCtx} />
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section title={forCommand.length > 0 ? s.teamSection : s.title}>
          {forTeam.length === 0 ? (
            <p className="text-base text-ink-2">{s.empty}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {forTeam.map((n) => (
                <li key={n.id}>
                  <NoticeCard notice={n} ctx={noticeCtx} />
                </li>
              ))}
            </ul>
          )}
          {canCommand ? null : <p className="mt-4 text-sm text-ink-2">{s.onlyCommand}</p>}
        </Section>
      </div>
    </>
  );
}

export default function NoticesPage({ params }: PageProps<"/t/[teamId]/notices">) {
  return (
    <Suspense fallback={<p className="text-ink-2">{strings.common.loading}</p>}>
      <Notices params={params} />
    </Suspense>
  );
}

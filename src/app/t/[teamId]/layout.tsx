import { Suspense } from "react";
import { connection } from "next/server";
import { getTeamContext } from "@/lib/data";
import { clock, dayLabel } from "@/lib/dates";
import { TeamBoard } from "@/components/board";
import { TabBar } from "@/components/tab-bar";

async function Board({ params }: { params: Promise<{ teamId: string }> }) {
  const teamId = Number((await params).teamId);
  const ctx = await getTeamContext(teamId);
  await connection();
  const now = new Date();
  return (
    <>
      <TeamBoard
        teamName={ctx.team.name}
        dayLabel={dayLabel(now)}
        time={clock(now)}
        onDuty={ctx.onDuty}
        nextUp={ctx.nextUp}
        me={ctx.me}
        today={ctx.today}
        teamId={teamId}
        canManage={ctx.permissions.can_manage}
      />
      <TabBar teamId={teamId} />
    </>
  );
}

function BoardFallback() {
  return <div aria-hidden className="h-36 bg-board" />;
}

export default function TeamLayout({ children, params }: LayoutProps<"/t/[teamId]">) {
  return (
    <div className="flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <Suspense fallback={<BoardFallback />}>
        <Board params={params} />
      </Suspense>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-5 pt-4">{children}</main>
    </div>
  );
}

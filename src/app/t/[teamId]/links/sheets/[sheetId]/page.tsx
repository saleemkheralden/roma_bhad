import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { readSheet } from "@/lib/google-sheets";
import { decodeSheetRef } from "@/lib/sheets";
import { clock } from "@/lib/dates";
import { strings } from "@/lib/strings";
import { SheetView } from "./sheet-view";

const s = strings.sheets;

async function Sheet({ params }: { params: Promise<{ teamId: string; sheetId: string }> }) {
  const { teamId: rawTeam, sheetId: rawSheet } = await params;
  const teamId = Number(rawTeam);
  const sheetId = Number(rawSheet);
  if (!Number.isFinite(teamId) || !Number.isFinite(sheetId)) notFound();

  // RLS: only members of this team get the row back.
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("integrations")
    .select("id, external_id, label")
    .eq("team_id", teamId)
    .eq("id", sheetId)
    .eq("kind", "gsheet")
    .maybeSingle();
  if (!row) notFound();
  const ref = decodeSheetRef(row.external_id);
  if (!ref) notFound();

  const result = await readSheet(ref);
  const googleUrl = `https://docs.google.com/spreadsheets/d/${ref.spreadsheetId}/edit${ref.gid !== null ? `#gid=${ref.gid}` : ""}`;
  const title = row.label || (result.status === "ok" ? [result.title, result.tab].filter(Boolean).join(" · ") : s.title);

  return (
    <>
      <div className="mb-4 flex items-end justify-between gap-3">
        <h1 className="min-w-0 truncate text-xl font-extrabold">{title}</h1>
        <Link href={`/t/${teamId}/links`} className="inline-flex min-h-11 shrink-0 items-center text-sm font-bold underline">
          {s.back}
        </Link>
      </div>

      {result.status === "ok" ? (
        <>
          <SheetView table={result.table} />
          {result.table.truncated ? <p className="mt-4 text-sm text-ink-2">{s.truncated}</p> : null}
          <p className="mt-4 text-xs text-ink-2">{s.updated(clock(new Date(result.fetchedAt)))}</p>
        </>
      ) : (
        <p role="alert" className="rounded-[var(--radius-cell)] bg-now-wash px-3 py-2 text-sm font-medium text-now-ink">
          {s.problem[result.problem]}
        </p>
      )}

      <a
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold underline"
      >
        {s.openInGoogle}
        <ExternalLink aria-hidden size={16} />
      </a>
    </>
  );
}

export default function SheetPage({ params }: PageProps<"/t/[teamId]/links/sheets/[sheetId]">) {
  return (
    <Suspense fallback={<p className="text-ink-2">{strings.common.loading}</p>}>
      <Sheet params={params} />
    </Suspense>
  );
}

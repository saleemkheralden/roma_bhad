import { ExternalLink } from "lucide-react";
import { embedUrl, openUrl, type EmbedMode } from "@/lib/calendar";
import { strings } from "@/lib/strings";

const c = strings.calendar;

/** Google Calendar embed in the board's frame. Events load from Google; nothing is stored here. */
export function CalendarEmbed({ ids, mode = "AGENDA", height = 380 }: { ids: string[]; mode?: EmbedMode; height?: number }) {
  if (ids.length === 0) return null;
  return (
    <div>
      <div className="overflow-hidden rounded-[var(--radius-control)] border border-rule bg-paper">
        <iframe
          title={c.frameTitle}
          src={embedUrl(ids, mode)}
          height={height}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          className="block w-full border-0"
        />
      </div>
      <a
        href={openUrl(ids[0])}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold underline"
      >
        {c.open}
        <ExternalLink aria-hidden size={16} />
      </a>
    </div>
  );
}

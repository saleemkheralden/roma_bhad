"use client";

import { linkify } from "@/lib/linkify";

/**
 * Free text with its web links made tappable. Links open in a new tab, carry no referrer,
 * and don't start a board drag or toggle the row they sit in.
 */
export function LinkedText({ text }: { text: string }) {
  return (
    <>
      {linkify(text).map((p, i) =>
        p.kind === "text" ? (
          p.text
        ) : (
          <a
            key={i}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            dir="ltr"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="font-medium underline decoration-rule-strong underline-offset-4 [overflow-wrap:anywhere]"
          >
            {p.text}
          </a>
        ),
      )}
    </>
  );
}

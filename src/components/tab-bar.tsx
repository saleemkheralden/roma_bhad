"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, ClipboardCheck, Link2, ListChecks, Megaphone, Users } from "lucide-react";
import { strings } from "@/lib/strings";

const t = strings.tabs;

export function TabBar({ teamId }: { teamId: number }) {
  const path = usePathname();
  const base = `/t/${teamId}`;
  const tabs = [
    { href: base, label: t.today, icon: CalendarCheck, active: path === base },
    { href: `${base}/notices`, label: t.notices, icon: Megaphone, active: path.startsWith(`${base}/notices`) },
    { href: `${base}/tasks`, label: t.tasks, icon: ListChecks, active: path.startsWith(`${base}/tasks`) },
    { href: `${base}/attendance`, label: t.attendance, icon: ClipboardCheck, active: path.startsWith(`${base}/attendance`) },
    { href: `${base}/team`, label: t.team, icon: Users, active: path.startsWith(`${base}/team`) },
    { href: `${base}/links`, label: t.links, icon: Link2, active: path.startsWith(`${base}/links`) },
  ];

  return (
    <nav
      aria-label={t.navLabel}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-xl">
        {tabs.map(({ href, label, icon: Icon, active }) => (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex h-16 flex-col items-center justify-center gap-0.5 text-xs ${
                active ? "font-extrabold text-ink shadow-[inset_0_3px_0_var(--color-now)]" : "font-medium text-ink-2"
              }`}
            >
              <Icon aria-hidden size={22} strokeWidth={active ? 2.4 : 1.8} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

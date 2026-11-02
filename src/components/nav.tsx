"use client";

import {
  Building2,
  Compass,
  FileText,
  KanbanSquare,
  LogOut,
  MoreHorizontal,
  Settings,
  Sparkles,
  Sprout,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

const SEARCH = [
  { href: "/matches", label: "Matches", icon: Sparkles },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
] as const;

const GROW = [
  { href: "/cv", label: "CV", icon: FileText },
  { href: "/grow", label: "Grow", icon: Sprout },
] as const;

const OTHER = [
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const ALL = [...SEARCH, ...GROW, ...OTHER];
// Phone tab bar: four places plus "More", which lists the rest.
const TABS = [SEARCH[0], SEARCH[1], SEARCH[2], GROW[0]];
const MORE = [GROW[1], ...OTHER];

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

export function SidebarNav({ counts }: { counts: Partial<Record<string, number>> }) {
  const path = usePathname();
  const item = ({ href, label, icon: Icon }: (typeof ALL)[number]) => {
    const count = counts[href];
    return (
      <Link
        key={href}
        href={href}
        className="nav-item"
        aria-current={isActive(path, href) ? "page" : undefined}
      >
        <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
        {label}
        {count ? <span className="nav-count">{count}</span> : null}
      </Link>
    );
  };
  return (
    <nav aria-label="Main" className="stack" style={{ gap: 4 }}>
      <div className="nav-section-label">Job search</div>
      {SEARCH.map(item)}
      <div className="nav-section-label">Career</div>
      {GROW.map(item)}
      <div className="nav-section-label">Studio</div>
      {OTHER.map(item)}
    </nav>
  );
}

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="logout"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
        window.location.assign("/login");
      }}
    >
      <LogOut size={20} strokeWidth={1.7} aria-hidden="true" />
      Sign out
    </button>
  );
}

export function TabBar() {
  const path = usePathname();
  const sheet = useRef<HTMLDivElement>(null);
  const moreActive = MORE.some((m) => isActive(path, m.href));
  return (
    <nav aria-label="Tabs" className="tabbar">
      {TABS.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={isActive(path, href) ? "page" : undefined}>
          <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
          {label}
        </Link>
      ))}
      <button
        type="button"
        popoverTarget="more-sheet"
        aria-current={moreActive ? "page" : undefined}
        aria-label="More"
      >
        <MoreHorizontal size={20} strokeWidth={1.75} aria-hidden="true" />
        More
      </button>
      <div id="more-sheet" ref={sheet} popover="auto" className="more-sheet">
        {MORE.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(path, href) ? "page" : undefined}
            onClick={() => sheet.current?.hidePopover()}
          >
            <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            {label}
          </Link>
        ))}
        <LogoutButton />
      </div>
    </nav>
  );
}

import { Plus, Search, Settings } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { LogoutButton, SidebarNav, TabBar } from "@/components/nav";
import { ToastProvider } from "@/components/toast";
import { formatWarsaw } from "@/lib/time";
import { requireSession } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { appStatus } from "@/server/status";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireSession();
  const s = await appStatus();
  const profile = await getSettings("profile");
  const firstName = profile.name.trim().split(/\s+/)[0] || "Łukasz";
  const sched = s.scheduler;
  return (
    <ToastProvider>
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      <div className="shell">
        <aside className="sidebar">
          <Link href="/matches" style={{ textDecoration: "none" }}>
            <Brand />
          </Link>
          <SidebarNav
            counts={{
              "/matches": s.counts.matches,
              "/explore": s.counts.explore,
              "/pipeline": s.counts.followUps,
            }}
          />
          <div className="sidebar-footer">
            <Link href="/settings#health" className="health secondary" style={{ textDecoration: "none" }}>
              <span
                className={`dot ${sched.enabled ? (sched.tickHealthy ? "dot-ok" : "dot-warn") : "dot-hollow"}`}
              />
              {sched.enabled
                ? `Next refresh ${formatWarsaw(sched.nextRefreshAt, "EEE, HH:mm")}`
                : "Daily refresh paused"}
            </Link>
            <Link href="/settings#claude" className="health secondary" style={{ textDecoration: "none" }}>
              <span className={`dot ${s.ai.configured ? "dot-ok" : "dot-hollow"}`} />
              {s.ai.configured
                ? `Claude on · $${s.ai.spend.monthUsd.toFixed(2)} this month`
                : "Claude not connected"}
            </Link>
            {!s.hasCv ? (
              <Link
                href="/settings#cv"
                className="health"
                style={{ color: "var(--warn)", textDecoration: "none" }}
              >
                <span className="dot dot-warn" />
                Upload your CV
              </Link>
            ) : null}
            <LogoutButton />
          </div>
        </aside>
        <div className="main">
          <header className="topbar">
            <form action="/matches" method="get" className="topbar-search" aria-label="Search offers">
              <input type="hidden" name="view" value="all" />
              <input
                name="q"
                type="search"
                placeholder="Search roles, companies, cities…"
                aria-label="Search"
              />
              <button type="submit" aria-label="Search">
                <Search size={19} strokeWidth={1.8} />
              </button>
            </form>
            <div className="topbar-spacer" />
            <Link
              href="/matches?add=1"
              className="icon-circle"
              aria-label="Add an offer you found"
              title="Add an offer"
            >
              <Plus size={19} strokeWidth={1.8} />
            </Link>
            <Link href="/settings" className="icon-circle" aria-label="Settings" title="Settings">
              <Settings size={18} strokeWidth={1.8} />
            </Link>
            <div className="user-chip">
              <span className="avatar" aria-hidden="true">
                {firstName.charAt(0).toUpperCase()}
              </span>
              <div>
                <strong>{firstName}</strong>
                <span>Take a Luke Studio</span>
              </div>
            </div>
          </header>
          <div id="content">{children}</div>
        </div>
      </div>
      <TabBar />
    </ToastProvider>
  );
}

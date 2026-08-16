"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { APP_CONFIG } from "@/lib/config";
import { useEffect, useState } from "react";
import { CommandPalette } from "@/components/command-palette";
import { QuickCaptureNote, QuickCaptureTask } from "@/components/advisor-quick-capture";
import { ResearchApiBanner } from "@/components/research-api-banner";

// Grouped by job-to-be-done so the sidebar reads as a map of the
// research program, not a flat feature list.
const NAV_SECTIONS = [
  {
    heading: "Research",
    items: [
      { href: "/spine", label: "PhD Spine", icon: SpineIcon },
      { href: "/cases", label: "Cases", icon: ClipboardIcon },
      { href: "/dashboard", label: "Dashboard", icon: ChartIcon },
    ],
  },
  {
    heading: "Field",
    items: [
      { href: "/fieldwork", label: "Field Journal", icon: JournalIcon },
      { href: "/contacts", label: "Contacts", icon: UsersIcon },
    ],
  },
  {
    heading: "Writing",
    items: [
      { href: "/papers", label: "Papers", icon: BookIcon },
      { href: "/apply", label: "Applications", icon: StampIcon },
      { href: "/funding", label: "Funding", icon: CoinsIcon },
      { href: "/docs", label: "Docs", icon: FileTextIcon },
      { href: "/workspace", label: "Workspace", icon: FolderIcon },
      { href: "/advisor", label: "Advisor", icon: BrainIcon },
    ],
  },
  {
    heading: "Reference",
    items: [
      { href: "/protocol", label: "Protocol", icon: ShieldIcon },
      { href: "/guide", label: "Guide", icon: CompassIcon },
    ],
  },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // Degraded mode (no env): show the configured owner rather than
    // crashing the shell — the shell wraps every page in the app.
    if (!supabase) {
      setUserEmail(APP_CONFIG.owner.email);
      setUserName(APP_CONFIG.owner.name);
      return;
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? APP_CONFIG.owner.email);
      setUserName(
        user?.user_metadata?.full_name ?? APP_CONFIG.owner.name,
      );
    });
  }, []);

  // Close sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-sidebar-border/80 bg-sidebar transition-transform duration-200 md:static md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="relative flex h-14 items-center gap-2.5 border-b border-sidebar-border/80 px-4">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
          />
          {/* The Signal — Tourist SOS brand mark (public/brand/, from the
              soswebsite kit; geometry is canonical, do not edit the SVGs).
              Animated variant drifts the Morse rings; stills under
              prefers-reduced-motion. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/signal-mark-animated.svg"
            alt=""
            aria-hidden="true"
            className="h-8 w-8 shrink-0"
          />
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-semibold tracking-tight text-sidebar-foreground">
              SOS PHD
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-sidebar-foreground/40">
              Research
            </span>
          </div>
        </div>

        <nav
          className="flex flex-1 flex-col gap-3 overflow-y-auto p-3"
          aria-label="Main navigation"
        >
          {NAV_SECTIONS.map((section) => (
            <div key={section.heading} className="flex flex-col gap-0.5">
              <span className="px-3 pb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-sidebar-foreground/30">
                {section.heading}
              </span>
              {section.items.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-gradient-to-r from-sidebar-accent to-sidebar-accent/40 text-sidebar-accent-foreground shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.04)]"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {/* Active rail */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary transition-opacity",
                    isActive
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-30",
                  )}
                />
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80",
                  )}
                />
                {item.label}
              </Link>
            );
              })}
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-1.5 border-t border-sidebar-border/80 p-3">
          {userEmail && (
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/10 font-mono text-[11px] font-semibold text-primary ring-1 ring-primary/20">
                {(userName ?? userEmail).charAt(0).toUpperCase()}
              </div>
              <div className="flex min-w-0 flex-col leading-tight">
                {userName && (
                  <p
                    className="truncate text-[12px] font-medium text-sidebar-foreground/90"
                    title={userName}
                  >
                    {userName}
                  </p>
                )}
                <p
                  className="truncate text-[11px] text-sidebar-foreground/45"
                  title={userEmail}
                >
                  {userEmail}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground disabled:opacity-50"
          >
            <LogOutIcon className="h-4 w-4" />
            {isSigningOut ? "Signing out..." : "Sign Out"}
          </button>
          <p className="px-3 pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/30">
            {APP_CONFIG.app.name} · v{APP_CONFIG.app.version}
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Silent unless the research data path is actually broken. */}
        <ResearchApiBanner />

        {/* Top bar — mobile nav toggle + quick actions */}
        <div className="flex items-center gap-2 border-b border-border/60 bg-background/60 px-3 py-2 backdrop-blur-md">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
            aria-label="Open navigation"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground md:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/signal-mark-dark.svg"
              alt=""
              aria-hidden="true"
              className="h-5 w-5"
            />
            SOS PHD
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() =>
                document.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "k", metaKey: true }),
                )
              }
              className="group hidden items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-accent/80 hover:text-foreground sm:flex"
            >
              <SearchIcon className="h-3.5 w-3.5" />
              <span>Search anything…</span>
              <kbd className="ml-2 rounded border border-border/70 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70">
                {typeof navigator !== "undefined" &&
                /Mac/.test(navigator.userAgent)
                  ? "⌘"
                  : "Ctrl+"}
                K
              </kbd>
            </button>
            <QuickCaptureNote />
            <QuickCaptureTask />
          </div>
        </div>
        {children}
      </main>

      {/* Command Palette (Cmd+K) */}
      <CommandPalette />
    </div>
  );
}

/* ── Inline icons ──── */

function SpineIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 2v20" />
      <path d="M8 6h8" />
      <path d="M7 10h10" />
      <path d="M8 14h8" />
      <path d="M9 18h6" />
    </svg>
  );
}

function CoinsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
  );
}

function StampIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 22h14" />
      <path d="M19.27 13.73A2.5 2.5 0 0 0 17.5 13h-11A2.5 2.5 0 0 0 4 15.5V18h16v-2.5c0-.66-.26-1.3-.73-1.77Z" />
      <path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-3-3 3 3 0 0 0-3 3c0 2 1 2 1 3.5V13" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 13H8" />
      <path d="M16 17H8" />
      <path d="M16 13h-2" />
    </svg>
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

function JournalIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M8 7h6" />
      <path d="M8 11h8" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CompassIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

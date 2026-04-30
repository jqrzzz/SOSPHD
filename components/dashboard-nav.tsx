"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/corridors", label: "Corridors", exact: false },
  { href: "/dashboard/digest", label: "Weekly Digest", exact: false },
  { href: "/dashboard/paper-builder", label: "Paper Builder", exact: false },
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex gap-1 border-b border-border px-6 pt-4"
      aria-label="Dashboard navigation"
    >
      {TABS.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-3 pb-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

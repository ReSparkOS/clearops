"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import { FilePlus2, LayoutDashboard, Menu, Settings, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: ComponentType<{ size?: number; className?: string }> };

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions/new", label: "New transaction", icon: FilePlus2 },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/rules", label: "Rules", icon: Settings },
];

export function AppShell({
  children,
  title,
  eyebrow,
  action,
}: {
  children: ReactNode;
  active?: string;
  title: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  primaryTransactionId?: string;
}) {
  const pathname = usePathname() ?? "";
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href || pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen bg-canvas text-ink lg:grid lg:grid-cols-[248px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-surface lg:flex">
        <BrandHeader />
        <SidebarNav isActive={isActive} />
        <SidebarFooter />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded-lg border border-line p-2 text-ink-muted transition hover:bg-surface-muted hover:text-ink"
          aria-label="Open navigation"
        >
          <Menu size={18} aria-hidden="true" />
        </button>
        <Image src="/brand/clearcloseiq-icon.svg" alt="" width={26} height={26} className="size-6" priority />
        <span className="text-sm font-semibold text-ink">Clear Close IQ</span>
      </div>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col border-r border-line bg-surface shadow-pop">
            <div className="flex items-center justify-between">
              <BrandHeader />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="mr-3 rounded-lg p-2 text-ink-muted transition hover:bg-surface-muted hover:text-ink"
                aria-label="Close navigation"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <SidebarNav isActive={isActive} onNavigate={() => setDrawerOpen(false)} />
            <SidebarFooter />
          </div>
        </div>
      ) : null}

      <main className="min-w-0">
        <header className="border-b border-line bg-surface px-5 py-5 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              {eyebrow ? (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">{eyebrow}</p>
              ) : null}
              <h1 className="mt-1 break-words text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
        </header>
        <div className="px-5 py-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}

function BrandHeader() {
  return (
    <Link href="/dashboard" className="flex h-16 items-center gap-2.5 px-5">
      <Image src="/brand/clearcloseiq-icon.svg" alt="" width={30} height={30} className="size-7 shrink-0" priority />
      <div className="leading-tight">
        <p className="text-sm font-semibold text-ink">Clear Close IQ</p>
        <p className="text-[11px] font-medium text-ink-subtle">Transaction coordination</p>
      </div>
    </Link>
  );
}

function SidebarNav({ isActive, onNavigate }: { isActive: (href: string) => boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-3">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const selected = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              selected
                ? "bg-primary-soft text-primary"
                : "text-ink-muted hover:bg-surface-muted hover:text-ink",
            )}
          >
            <Icon size={17} className={selected ? "text-primary" : "text-ink-subtle"} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  return (
    <div className="border-t border-line px-5 py-3">
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        Live · Supabase
      </span>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3Icon,
  BookOpenCheckIcon,
  CalendarCheck2Icon,
  CalendarDaysIcon,
  FilePenLineIcon,
  HomeIcon,
  LineChartIcon,
  LogOutIcon,
  MegaphoneIcon,
  PlayIcon,
  Settings2Icon,
  SparklesIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { Brand } from "@/components/brand";
import { signOutAction } from "@/actions/portal";
import type { ParentNavItem } from "@/lib/constants";
import { cn } from "@/lib/utils";

const iconMap = {
  "layout-dashboard": BarChart3Icon,
  home: HomeIcon,
  sparkles: SparklesIcon,
  play: PlayIcon,
  "calendar-days": CalendarDaysIcon,
  "line-chart": LineChartIcon,
  users: UsersIcon,
  "book-open-check": BookOpenCheckIcon,
  "calendar-check-2": CalendarCheck2Icon,
  "file-pen-line": FilePenLineIcon,
  wallet: WalletIcon,
  megaphone: MegaphoneIcon,
  "bar-chart-3": BarChart3Icon,
  "settings-2": Settings2Icon,
} as const;

/**
 * Parent portal navigation.
 *
 * Desktop: a persistent left rail, grouped, with the "More" bucket expanded so
 * nothing is hidden behind an extra click on a large screen.
 * Mobile: the rail is hidden entirely and replaced by `ParentBottomNav`, so no
 * drawer is needed for the five primary destinations (brief section 68).
 */
export function ParentSidebar({
  navItems,
  userName,
  userEmail,
  onNavigate,
}: {
  navItems: ParentNavItem[];
  userName: string;
  userEmail: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const primary = navItems.filter((i) => i.group === "primary");
  const more = navItems.filter((i) => i.group === "more");

  function renderLink(item: ParentNavItem) {
    const Icon = iconMap[item.icon as keyof typeof iconMap] ?? HomeIcon;
    const active = pathname === item.href;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
          active
            ? "bg-white text-slate-950 shadow-sm"
            : "text-slate-300 hover:bg-white/8 hover:text-white",
        )}
      >
        <Icon className="size-4 transition-transform duration-200 group-hover:scale-110" aria-hidden />
        <span>{item.label}</span>
        {active && (
          <span className="absolute -left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary" />
        )}
      </Link>
    );
  }

  return (
    <div className="flex h-full flex-col justify-between rounded-[2rem] bg-slate-950 p-5 text-slate-100 shadow-soft">
      <div className="space-y-8">
        <Brand className="text-white [&_*:last-child]:text-slate-400" />
        <nav className="space-y-1" aria-label="Parent portal">
          {primary.map(renderLink)}
          <div className="pt-3">
            <p className="px-4 pb-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
              More
            </p>
            {more.map(renderLink)}
          </div>
        </nav>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Parent</p>
          <p className="mt-3 text-sm font-semibold text-white">{userName}</p>
          <p className="mt-1 text-xs text-slate-400">{userEmail}</p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-400 transition-colors hover:bg-white/8 hover:text-white"
          >
            <LogOutIcon className="size-4" aria-hidden />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Mobile bottom bar. Exactly the five primary destinations, always visible,
 * with a safe-area inset so it clears the home indicator on iOS.
 */
export function ParentBottomNav({ navItems }: { navItems: ParentNavItem[] }) {
  const pathname = usePathname();
  const items = navItems.filter((i) => i.bottomBar);

  return (
    <nav
      aria-label="Parent portal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-lg lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between">
        {items.map((item) => {
          const Icon = iconMap[item.icon as keyof typeof iconMap] ?? HomeIcon;
          // "/parent" must not highlight for every nested route.
          const active =
            item.href === "/parent" ? pathname === "/parent" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[0.7rem] font-medium transition-colors",
                // 44px minimum touch target (section 71).
                "min-h-[56px] justify-center",
                active ? "text-primary" : "text-slate-500 hover:text-slate-900",
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

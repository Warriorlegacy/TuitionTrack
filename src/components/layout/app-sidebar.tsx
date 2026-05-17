"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3Icon,
  BookOpenCheckIcon,
  CalendarCheck2Icon,
  FilePenLineIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MegaphoneIcon,
  Settings2Icon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import type { NavItem } from "@/lib/constants";
import { Brand } from "@/components/brand";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/actions/portal";

const iconMap = {
  "layout-dashboard": LayoutDashboardIcon,
  users: UsersIcon,
  "book-open-check": BookOpenCheckIcon,
  "calendar-check-2": CalendarCheck2Icon,
  "file-pen-line": FilePenLineIcon,
  wallet: WalletIcon,
  megaphone: MegaphoneIcon,
  "bar-chart-3": BarChart3Icon,
  "settings-2": Settings2Icon,
};

export function AppSidebar({
  navItems,
  roleLabel,
  userName,
  userEmail,
  onNavigate,
}: {
  navItems: NavItem[];
  roleLabel: string;
  userName: string;
  userEmail: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col justify-between rounded-[2rem] bg-slate-950 p-5 text-slate-100 shadow-soft">
      <div className="space-y-8">
        <Brand className="text-white [&_*:last-child]:text-slate-400" />
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = iconMap[item.icon];
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-300 hover:bg-white/8 hover:text-white",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 transition-transform duration-200",
                    !active && "group-hover:scale-110",
                  )}
                />
                <span>{item.label}</span>
                {active && (
                  <span className="absolute -left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {roleLabel}
          </p>
          <p className="mt-3 text-sm font-semibold text-white">{userName}</p>
          <p className="mt-1 text-xs text-slate-400">{userEmail}</p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-400 transition-colors hover:bg-white/8 hover:text-white"
          >
            <LogOutIcon className="size-4" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

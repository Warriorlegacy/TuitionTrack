"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  BookOpenCheckIcon,
  BookOpenIcon,
  FilePenLineIcon,
  PlayIcon,
  LineChartIcon,
  MegaphoneIcon,
  UserIcon,
  LogOutIcon,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/actions/portal";

export type StudentNavItem = {
  href: string;
  label: string;
  icon:
    | "layout-dashboard"
    | "book-open-check"
    | "book-open"
    | "file-pen-line"
    | "play"
    | "line-chart"
    | "megaphone"
    | "user";
};

export const studentNav: StudentNavItem[] = [
  { href: "/student/dashboard", label: "Dashboard", icon: "layout-dashboard" },
  { href: "/student/profile", label: "Profile & Settings", icon: "user" },
];

const iconMap = {
  "layout-dashboard": LayoutDashboardIcon,
  "book-open-check": BookOpenCheckIcon,
  "book-open": BookOpenIcon,
  "file-pen-line": FilePenLineIcon,
  play: PlayIcon,
  "line-chart": LineChartIcon,
  megaphone: MegaphoneIcon,
  user: UserIcon,
};

export function StudentSidebar({
  userName,
  userEmail,
  studentClass,
}: {
  userName: string;
  userEmail: string;
  studentClass?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col justify-between rounded-[2rem] bg-slate-950 p-5 text-slate-100 shadow-soft">
      <div className="space-y-8">
        <Brand className="text-white [&_*:last-child]:text-slate-400" />
        <nav className="space-y-1">
          {studentNav.map((item) => {
            const Icon = iconMap[item.icon];
            const active = pathname === item.href || (item.href !== "/student/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
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
                  <span className="absolute -left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-emerald-500" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
              Student Portal
            </p>
            {studentClass && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                Class {studentClass}
              </span>
            )}
          </div>
          <p className="mt-3 text-sm font-semibold text-white truncate">{userName}</p>
          <p className="mt-0.5 text-xs text-slate-400 truncate">{userEmail}</p>
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-white/8 hover:text-white"
          >
            <LogOutIcon className="size-4" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

export function StudentBottomNav() {
  const pathname = usePathname();

  const primaryItems = [
    { href: "/student/dashboard", label: "Home", icon: LayoutDashboardIcon },
    { href: "/student/homework", label: "Homework", icon: BookOpenCheckIcon },
    { href: "/student/lessons", label: "Lessons", icon: PlayIcon },
    { href: "/student/tests", label: "Tests", icon: FilePenLineIcon },
    { href: "/student/profile", label: "Profile", icon: UserIcon },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur-lg lg:hidden">
      {primaryItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-1 text-[11px] font-medium transition-colors",
              active ? "text-emerald-600 font-semibold" : "text-slate-500",
            )}
          >
            <Icon className="size-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

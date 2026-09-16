"use client";

// Mobile bottom nav for the student slice: Home / Study / Tests / Progress / Tutor.
// ponytail: links only, no state. Desktop keeps the portal sidebar untouched.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenCheckIcon,
  CalendarDaysIcon,
  ClipboardCheckIcon,
  HomeIcon,
  LineChartIcon,
  SparklesIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/app/dashboard", label: "Home", icon: HomeIcon },
  { href: "/app/today", label: "Study", icon: BookOpenCheckIcon },
  { href: "/app/tests", label: "Tests", icon: ClipboardCheckIcon },
  { href: "/app/progress", label: "Progress", icon: LineChartIcon },
  { href: "/app/planner", label: "Plan", icon: CalendarDaysIcon },
  { href: "/app/tutor", label: "Tutor", icon: SparklesIcon },
];

export function StudentNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Student"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-6">
        {ITEMS.map((it) => {
          const active = pathname === it.href || (it.href !== "/app/dashboard" && pathname.startsWith(it.href));
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "tt-focus flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                  active ? "text-primary" : "text-slate-500",
                )}
              >
                <it.icon className="size-5" aria-hidden />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

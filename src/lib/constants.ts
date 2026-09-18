import type { AppRole } from "@/lib/db/types";

export const roleLabels: Record<AppRole, string> = {
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};

export const routeTitles: Record<string, string> = {
  "/app/dashboard": "Dashboard",
  "/app/today": "Today",
  "/app/progress": "Progress",
  "/app/planner": "Planner",
  "/app/tutor": "AI Tutor",
  "/app/videos": "Videos",
  "/app/students": "Students",
  "/app/homework": "Homework",
  "/app/attendance": "Attendance",
  "/app/tests": "Tests",
  "/app/fees": "Fees",
  "/app/announcements": "Announcements",
  "/app/reports": "Reports",
  "/app/settings": "Settings",
  "/app/ai-settings": "AI Settings",
};

export type NavIcon =
  | "layout-dashboard"
  | "home"
  | "sparkles"
  | "play"
  | "calendar-days"
  | "line-chart"
  | "book-open-check"
  | "users"
  | "calendar-check-2"
  | "file-pen-line"
  | "wallet"
  | "megaphone"
  | "bar-chart-3"
  | "settings-2";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  roles: AppRole[];
};

export const appNav: NavItem[] = [
  {
    href: "/app/dashboard",
    label: "Dashboard",
    icon: "layout-dashboard",
    roles: ["teacher", "parent", "student"],
  },
  {
    href: "/app/today",
    label: "Today",
    icon: "home",
    roles: ["teacher", "parent", "student"],
  },
  {
    href: "/app/progress",
    label: "Progress",
    icon: "line-chart",
    roles: ["teacher", "parent", "student"],
  },
  {
    href: "/app/planner",
    label: "Planner",
    icon: "calendar-days",
    roles: ["teacher", "parent", "student"],
  },
  {
    href: "/app/tutor",
    label: "AI Tutor",
    icon: "sparkles",
    roles: ["teacher", "parent", "student"],
  },
  {
    href: "/app/videos",
    label: "Videos",
    icon: "play",
    roles: ["teacher", "parent", "student"],
  },
  {
    href: "/app/students",
    label: "Students",
    icon: "users",
    roles: ["teacher", "parent"],
  },
  {
    href: "/app/homework",
    label: "Homework",
    icon: "book-open-check",
    roles: ["teacher", "parent", "student"],
  },
  {
    href: "/app/attendance",
    label: "Attendance",
    icon: "calendar-check-2",
    roles: ["teacher", "parent"],
  },
  {
    href: "/app/tests",
    label: "Tests",
    icon: "file-pen-line",
    roles: ["teacher", "parent", "student"],
  },
  {
    href: "/app/fees",
    label: "Fees",
    icon: "wallet",
    roles: ["teacher", "parent"],
  },
  {
    href: "/app/announcements",
    label: "Announcements",
    icon: "megaphone",
    roles: ["teacher", "parent"],
  },
  {
    href: "/app/reports",
    label: "Reports",
    icon: "bar-chart-3",
    roles: ["teacher", "parent", "student"],
  },
  {
    href: "/app/settings",
    label: "Settings",
    icon: "settings-2",
    roles: ["teacher", "parent", "student"],
  },
  {
    href: "/app/ai-settings",
    label: "AI Settings",
    icon: "settings-2",
    roles: ["teacher", "parent", "student"],
  },
];

export function canAccessRoute(role: AppRole | null, href: string) {
  if (!role) return false;
  const item = appNav.find((entry) => entry.href === href);
  if (!item) return true;
  return item.roles.includes(role);
}

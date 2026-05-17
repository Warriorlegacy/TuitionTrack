import type { AppRole } from "@/lib/db/types";

export const roleLabels: Record<AppRole, string> = {
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};

export const routeTitles: Record<string, string> = {
  "/app/dashboard": "Dashboard",
  "/app/students": "Students",
  "/app/homework": "Homework",
  "/app/attendance": "Attendance",
  "/app/tests": "Tests",
  "/app/fees": "Fees",
  "/app/announcements": "Announcements",
  "/app/reports": "Reports",
  "/app/settings": "Settings",
};

export type NavIcon =
  | "layout-dashboard"
  | "users"
  | "book-open-check"
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
];

export function canAccessRoute(role: AppRole | null, href: string) {
  if (!role) return false;
  const item = appNav.find((entry) => entry.href === href);
  if (!item) return true;
  return item.roles.includes(role);
}

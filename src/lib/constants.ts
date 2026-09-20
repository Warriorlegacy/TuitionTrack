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
  "/app/curriculum": "NCERT & Curriculum",
  "/app/homework": "Homework",
  "/app/attendance": "Attendance",
  "/app/tests": "Tests",
  "/app/fees": "Fees",
  "/app/payments": "Payments",
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
    href: "/app/curriculum",
    label: "NCERT & Curriculum",
    icon: "book-open-check",
    roles: ["teacher", "parent", "student"],
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
    // Staff-only. Payment proof verification must never appear to a parent,
    // even as a nav link — the parent surface is /parent/fees.
    href: "/app/payments",
    label: "Payments",
    icon: "wallet",
    roles: ["teacher"],
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

// ── Parent Portal navigation ─────────────────────────────────────────────────
// The parent portal is a separate namespace (`/parent/*`) with its own shell.
// It deliberately does NOT reuse appNav: the teacher workspace and the family
// experience are different products, and mixing them was how the previous
// parent view ended up showing teacher-oriented copy. See brief section 68.

export type ParentNavGroup = "primary" | "more";

export type ParentNavItem = NavItem & {
  group: ParentNavGroup;
  /** Shown in the mobile bottom bar. Exactly five items, per section 68. */
  bottomBar?: boolean;
};

export const parentNav: ParentNavItem[] = [
  { href: "/parent", label: "Home", icon: "home", roles: ["parent"], group: "primary", bottomBar: true },
  { href: "/parent/progress", label: "Progress", icon: "line-chart", roles: ["parent"], group: "primary", bottomBar: true },
  { href: "/parent/homework", label: "Homework", icon: "book-open-check", roles: ["parent"], group: "primary", bottomBar: true },
  { href: "/parent/fees", label: "Fees", icon: "wallet", roles: ["parent"], group: "primary", bottomBar: true },
  { href: "/parent/more", label: "More", icon: "settings-2", roles: ["parent"], group: "primary", bottomBar: true },

  { href: "/parent/syllabus", label: "Syllabus", icon: "book-open-check", roles: ["parent"], group: "more" },
  { href: "/parent/assignments", label: "Assignments", icon: "file-pen-line", roles: ["parent"], group: "more" },
  { href: "/parent/tests", label: "Tests", icon: "file-pen-line", roles: ["parent"], group: "more" },
  { href: "/parent/attendance", label: "Attendance", icon: "calendar-check-2", roles: ["parent"], group: "more" },
  { href: "/parent/reports", label: "Reports", icon: "bar-chart-3", roles: ["parent"], group: "more" },
  { href: "/parent/ask", label: "Ask AI", icon: "sparkles", roles: ["parent"], group: "more" },
  { href: "/parent/meetings", label: "Meetings (PTM)", icon: "calendar-days", roles: ["parent"], group: "more" },
  { href: "/parent/portfolio", label: "Portfolio", icon: "book-open-check", roles: ["parent"], group: "more" },
  { href: "/parent/calendar", label: "Calendar", icon: "calendar-days", roles: ["parent"], group: "more" },
  { href: "/parent/messages", label: "Messages", icon: "megaphone", roles: ["parent"], group: "more" },
  { href: "/parent/documents", label: "Documents", icon: "file-pen-line", roles: ["parent"], group: "more" },
  { href: "/parent/notifications", label: "Notifications", icon: "megaphone", roles: ["parent"], group: "more" },
  { href: "/parent/profile", label: "Profile", icon: "settings-2", roles: ["parent"], group: "more" },
  { href: "/parent/support", label: "Support", icon: "sparkles", roles: ["parent"], group: "more" },
];

/** The five items shown in the mobile bottom bar, in order. */
export const parentBottomNav = parentNav.filter((item) => item.bottomBar);

/** Sidebar items for desktop: primary first, then everything else. */
export const parentSidebarNav = parentNav;


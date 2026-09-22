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
  | "settings-2"
  | "link";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  roles: AppRole[];
};

// Route authorization table for all functional subpaths accessible from the dashboard launchpad
export const routePermissions: Record<string, AppRole[]> = {
  "/app/dashboard": ["teacher", "parent", "student"],
  "/app/today": ["teacher", "parent", "student"],
  "/app/progress": ["teacher", "parent", "student"],
  "/app/planner": ["teacher", "parent", "student"],
  "/app/tutor": ["teacher", "parent", "student"],
  "/app/videos": ["teacher", "parent", "student"],
  "/app/students": ["teacher"],
  "/app/curriculum": ["teacher", "parent", "student"],
  "/app/homework": ["teacher", "parent", "student"],
  "/app/attendance": ["teacher"],
  "/app/tests": ["teacher", "parent", "student"],
  "/app/fees": ["teacher"],
  "/app/payments": ["teacher"],
  "/app/announcements": ["teacher"],
  "/app/reports": ["teacher", "parent", "student"],
  "/app/workspace": ["teacher"],
  "/app/workspace/members": ["teacher"],
  "/app/portal-access": ["teacher"],
  "/app/settings": ["teacher", "parent", "student"],
  "/app/ai-settings": ["teacher"],
};

export const appNav: NavItem[] = [
  {
    href: "/app/dashboard",
    label: "Dashboard",
    icon: "layout-dashboard",
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
    icon: "sparkles",
    roles: ["teacher"],
  },
];

export function canAccessRoute(role: AppRole | null, href: string) {
  if (!role) return false;
  const allowed = routePermissions[href];
  if (!allowed) return true;
  return allowed.includes(role);
}

// ── Parent Portal navigation ─────────────────────────────────────────────────
// Streamlined single dashboard access for parents.

export type ParentNavGroup = "primary" | "more";

export type ParentNavItem = NavItem & {
  group: ParentNavGroup;
  bottomBar?: boolean;
};

export const parentNav: ParentNavItem[] = [
  { href: "/parent", label: "Dashboard", icon: "layout-dashboard", roles: ["parent"], group: "primary", bottomBar: true },
  { href: "/parent/profile", label: "Profile & Settings", icon: "settings-2", roles: ["parent"], group: "primary", bottomBar: true },
];

/** Items shown in the mobile bottom bar */
export const parentBottomNav = parentNav;

/** Sidebar items for desktop */
export const parentSidebarNav = parentNav;



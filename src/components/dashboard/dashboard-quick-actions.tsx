import Link from "next/link";
import {
  PlusIcon,
  BookOpenCheckIcon,
  CalendarCheck2Icon,
  FilePenLineIcon,
  WalletIcon,
  MegaphoneIcon,
  Link2Icon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function DashboardQuickActions() {
  const actions = [
    { label: "Add Student", href: "/app/students", icon: PlusIcon },
    { label: "Assign Homework", href: "/app/homework", icon: BookOpenCheckIcon },
    { label: "Record Attendance", href: "/app/attendance", icon: CalendarCheck2Icon },
    { label: "Create Test", href: "/app/tests", icon: FilePenLineIcon },
    { label: "Add Fee", href: "/app/fees", icon: WalletIcon },
    { label: "Send Announcement", href: "/app/announcements", icon: MegaphoneIcon },
    {
      label: "Manage Portal Access",
      href: "/app/portal-access",
      icon: Link2Icon,
      highlight: true,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1 pb-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">
        Quick Actions:
      </span>
      {actions.map((act) => {
        const Icon = act.icon;
        return (
          <Link
            key={act.href}
            href={act.href}
            className={buttonVariants({
              variant: act.highlight ? "default" : "outline",
              size: "sm",
              className: `h-8 gap-1.5 text-xs font-medium ${
                act.highlight
                  ? "bg-slate-900 text-white hover:bg-slate-800 shadow-xs"
                  : "border-slate-200 bg-white/80 hover:bg-slate-100"
              }`,
            })}
          >
            <Icon className="size-3.5" />
            <span>{act.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

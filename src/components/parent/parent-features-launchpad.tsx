import Link from "next/link";
import {
  BookOpenCheckIcon,
  LineChartIcon,
  CalendarCheck2Icon,
  FilePenLineIcon,
  WalletIcon,
  SparklesIcon,
  MegaphoneIcon,
  BarChart3Icon,
  ArrowUpRightIcon,
} from "lucide-react";

export function ParentFeaturesLaunchpad({
  overdueHwCount = 0,
  pendingFeesCount = 0,
}: {
  overdueHwCount?: number;
  pendingFeesCount?: number;
}) {
  const features = [
    {
      title: "Homework Hub",
      description: "Monitor daily homework completion, teacher remarks, and upcoming deadlines.",
      href: "/parent/homework",
      icon: BookOpenCheckIcon,
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
      badge: overdueHwCount > 0 ? `${overdueHwCount} Overdue` : "Daily Tracker",
      badgeColor: overdueHwCount > 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800",
    },
    {
      title: "Child Progress & Mastery",
      description: "Track chapter-by-chapter mastery, syllabus coverage, and learning pace.",
      href: "/parent/progress",
      icon: LineChartIcon,
      color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30",
      badge: "Analytics",
      badgeColor: "bg-indigo-100 text-indigo-800",
    },
    {
      title: "Attendance Calendar",
      description: "Day-by-day attendance records, monthly attendance percentage, and leave history.",
      href: "/parent/attendance",
      icon: CalendarCheck2Icon,
      color: "text-teal-600 bg-teal-50 dark:bg-teal-950/30",
      badge: "Attendance Log",
      badgeColor: "bg-teal-100 text-teal-800",
    },
    {
      title: "Assessments & Tests",
      description: "Review test marks, exam scores, class averages, and subject grade trends.",
      href: "/parent/tests",
      icon: FilePenLineIcon,
      color: "text-sky-600 bg-sky-50 dark:bg-sky-950/30",
      badge: "Exams & Marks",
      badgeColor: "bg-sky-100 text-sky-800",
    },
    {
      title: "Tuition Fees & Payments",
      description: "View pending fee dues, pay tuition, view UPI QR, and submit payment proofs.",
      href: "/parent/fees",
      icon: WalletIcon,
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
      badge: pendingFeesCount > 0 ? `${pendingFeesCount} Due` : "Tuition Fee",
      badgeColor: pendingFeesCount > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800",
    },
    {
      title: "Ask AI About My Child",
      description: "Ask anything about your child's strengths, weaknesses, and today's recommendations.",
      href: "/parent/ask",
      icon: SparklesIcon,
      color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30",
      badge: "AI Copilot",
      badgeColor: "bg-purple-100 text-purple-800",
    },
    {
      title: "Teacher Announcements",
      description: "Important notices, exam dates, holiday schedules, and tuition circulars.",
      href: "/parent/announcements",
      icon: MegaphoneIcon,
      color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
      badge: "Noticeboard",
      badgeColor: "bg-amber-100 text-amber-800",
    },
    {
      title: "Academic Report Cards",
      description: "Comprehensive progress reports, semester performance, and PTM summaries.",
      href: "/parent/reports",
      icon: BarChart3Icon,
      color: "text-rose-600 bg-rose-50 dark:bg-rose-950/30",
      badge: "Report Cards",
      badgeColor: "bg-rose-100 text-rose-800",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Parent Command Center
          </h2>
          <p className="text-xs text-slate-500">
            Everything accessible in 1 click right from this single dashboard — nothing is hidden.
          </p>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-500/40 hover:shadow-md"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div
                    className={`flex size-9 items-center justify-center rounded-xl ${item.color} transition-transform group-hover:scale-105`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-1">
                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                      {item.title}
                    </h3>
                    <ArrowUpRightIcon className="size-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    {item.description}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] font-medium text-indigo-600">
                <span>Open Section</span>
                <span className="text-slate-400 group-hover:translate-x-0.5 transition-transform">
                  →
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

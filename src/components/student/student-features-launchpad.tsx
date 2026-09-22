import Link from "next/link";
import {
  BookOpenCheckIcon,
  PlayIcon,
  SparklesIcon,
  FilePenLineIcon,
  LineChartIcon,
  MegaphoneIcon,
  ArrowUpRightIcon,
} from "lucide-react";

export function StudentFeaturesLaunchpad({
  pendingHomeworkCount = 0,
  testCount = 0,
}: {
  pendingHomeworkCount?: number;
  testCount?: number;
}) {
  const features = [
    {
      title: "My Homework Hub",
      description: "View and submit daily tuition homework, track deadlines, and see teacher remarks.",
      href: "/student/homework",
      icon: BookOpenCheckIcon,
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
      badge: pendingHomeworkCount > 0 ? `${pendingHomeworkCount} Pending` : "Up to Date",
      badgeColor: pendingHomeworkCount > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800",
    },
    {
      title: "3D NCERT Visual Lessons",
      description: "Explore interactive 3D science simulations and 1-hour chapter video lessons.",
      href: "/student/lessons",
      icon: PlayIcon,
      color: "text-rose-600 bg-rose-50 dark:bg-rose-950/30",
      badge: "Interactive 3D",
      badgeColor: "bg-rose-100 text-rose-800",
    },
    {
      title: "AI Doubt Solver & Copilot",
      description: "Get instant step-by-step guidance and practice problems for tricky topics.",
      href: "/app/tutor",
      icon: SparklesIcon,
      color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30",
      badge: "AI Powered",
      badgeColor: "bg-purple-100 text-purple-800",
    },
    {
      title: "Tests & Quiz Scores",
      description: "Review your test marks, subject percentages, and test solutions.",
      href: "/student/tests",
      icon: FilePenLineIcon,
      color: "text-sky-600 bg-sky-50 dark:bg-sky-950/30",
      badge: `${testCount} Recorded`,
      badgeColor: "bg-sky-100 text-sky-800",
    },
    {
      title: "My Academic Progress",
      description: "Track concept mastery across chapters and view your learning curve.",
      href: "/student/progress",
      icon: LineChartIcon,
      color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30",
      badge: "Analytics",
      badgeColor: "bg-indigo-100 text-indigo-800",
    },
    {
      title: "Class Announcements",
      description: "Latest notices, exam timetables, and holiday schedules from your teacher.",
      href: "/student/announcements",
      icon: MegaphoneIcon,
      color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
      badge: "Noticeboard",
      badgeColor: "bg-amber-100 text-amber-800",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Student Learning Hub
          </h2>
          <p className="text-xs text-slate-500">
            Everything accessible in 1 click right from your single dashboard.
          </p>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-md"
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
                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      {item.title}
                    </h3>
                    <ArrowUpRightIcon className="size-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    {item.description}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] font-medium text-emerald-600">
                <span>Open Tool</span>
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

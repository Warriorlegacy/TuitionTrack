import Link from "next/link";
import {
  BookOpenCheckIcon,
  PlayIcon,
  SparklesIcon,
  CalendarDaysIcon,
  UsersIcon,
  CalendarCheck2Icon,
  FilePenLineIcon,
  LineChartIcon,
  WalletIcon,
  CreditCardIcon,
  MegaphoneIcon,
  BarChart3Icon,
  ShieldCheckIcon,
  ArrowUpRightIcon,
} from "lucide-react";

export function TeacherFeaturesLaunchpad() {
  const sections = [
    {
      category: "Academic & AI Tools",
      items: [
        {
          title: "AI Homework Studio & Logs",
          description: "Create AI-powered homework with answer keys, review student submissions question by question, and publish teacher-graded results.",
          href: "/app/homework",
          icon: BookOpenCheckIcon,
          color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30",
          badge: "AI Powered",
          badgeColor: "bg-purple-100 text-purple-700",
        },
        {
          title: "3D NCERT Visual Lessons",
          description: "Interactive 3D science simulations and full 1-hour chapter lecture videos for classes 6–12.",
          href: "/app/videos",
          icon: PlayIcon,
          color: "text-rose-600 bg-rose-50 dark:bg-rose-950/30",
          badge: "3D Interactive",
          badgeColor: "bg-rose-100 text-rose-700",
        },
        {
          title: "AI Tutor Copilot",
          description: "Ask the TuitionTrack AI Copilot to generate remedial drills, diagnose weak spots, and solve doubts.",
          href: "/app/tutor",
          icon: SparklesIcon,
          color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
          badge: "Copilot",
          badgeColor: "bg-amber-100 text-amber-700",
        },
        {
          title: "NCERT Curriculum & Planner",
          description: "Chapter-wise curriculum tracking, syllabus timeline, and daily lesson scheduling.",
          href: "/app/planner",
          icon: CalendarDaysIcon,
          color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
          badge: "Syllabus",
          badgeColor: "bg-blue-100 text-blue-700",
        },
      ],
    },
    {
      category: "Classroom Operations",
      items: [
        {
          title: "Students Roster & Unique Codes",
          description: "Manage student profiles, view their universal link codes (STU-XXXXXX), and assign classes.",
          href: "/app/students",
          icon: UsersIcon,
          color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
          badge: "Universal Codes",
          badgeColor: "bg-emerald-100 text-emerald-700",
        },
        {
          title: "Daily Attendance Register",
          description: "Record daily attendance with one tap, track 60-day attendance trends, and monitor absenteeism.",
          href: "/app/attendance",
          icon: CalendarCheck2Icon,
          color: "text-teal-600 bg-teal-50 dark:bg-teal-950/30",
          badge: "Daily Log",
          badgeColor: "bg-teal-100 text-teal-700",
        },
        {
          title: "Tests & Grade Assessments",
          description: "Schedule exams, record marks, compute class averages, and analyze subject performance.",
          href: "/app/tests",
          icon: FilePenLineIcon,
          color: "text-sky-600 bg-sky-50 dark:bg-sky-950/30",
          badge: "Grading",
          badgeColor: "bg-sky-100 text-sky-700",
        },
        {
          title: "Academic Progress & Risk Analytics",
          description: "Track concept mastery levels, flag struggling students early, and inspect learning curves.",
          href: "/app/progress",
          icon: LineChartIcon,
          color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30",
          badge: "Analytics",
          badgeColor: "bg-indigo-100 text-indigo-700",
        },
      ],
    },
    {
      category: "Fees, Announcements & Administration",
      items: [
        {
          title: "Tuition Fees & Payments",
          description: "Tuition fee ledgers, automated receipts, pending balances, and overdue fee reminders.",
          href: "/app/fees",
          icon: WalletIcon,
          color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
          badge: "Ledger",
          badgeColor: "bg-emerald-100 text-emerald-700",
        },
        {
          title: "UPI Verification & Proofs",
          description: "Review and approve parent UPI payment transaction screenshots and receipts.",
          href: "/app/payments",
          icon: CreditCardIcon,
          color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30",
          badge: "UPI QR",
          badgeColor: "bg-cyan-100 text-cyan-700",
        },
        {
          title: "Announcements & Noticeboard",
          description: "Broadcast instant updates, exam schedules, and holiday notices to students and parents.",
          href: "/app/announcements",
          icon: MegaphoneIcon,
          color: "text-orange-600 bg-orange-50 dark:bg-orange-950/30",
          badge: "Broadcast",
          badgeColor: "bg-orange-100 text-orange-700",
        },
        {
          title: "Student Report Cards & PTM",
          description: "Generate printable student performance cards and parent-teacher meeting summaries.",
          href: "/app/reports",
          icon: BarChart3Icon,
          color: "text-violet-600 bg-violet-50 dark:bg-violet-950/30",
          badge: "Reports",
          badgeColor: "bg-violet-100 text-violet-700",
        },
        {
          title: "Workspace Members & Roles",
          description: "Manage co-teachers, role permissions, and view all linked parent and student accounts.",
          href: "/app/workspace/members",
          icon: ShieldCheckIcon,
          color: "text-slate-700 bg-slate-100 dark:bg-slate-800",
          badge: "Access Control",
          badgeColor: "bg-slate-200 text-slate-800",
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            TuitionTrack Control Center
          </h2>
          <p className="text-xs text-slate-500">
            Access every workspace feature directly in 1-click — nothing is hidden.
          </p>
        </div>
      </div>

      {sections.map((sec) => (
        <div key={sec.category} className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {sec.category}
          </p>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sec.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
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
                        <h3 className="text-sm font-semibold text-slate-900 group-hover:text-primary transition-colors">
                          {item.title}
                        </h3>
                        <ArrowUpRightIcon className="size-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] font-medium text-primary">
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
      ))}
    </div>
  );
}

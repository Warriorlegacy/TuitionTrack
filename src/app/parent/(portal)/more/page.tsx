import Link from "next/link";
import { CalendarCheckIcon, FileTextIcon, BrainIcon, MegaphoneIcon, BarChart3Icon, CalendarDaysIcon, BellIcon, UserIcon, LifeBuoyIcon, BookOpenIcon, ChevronRightIcon, SparklesIcon, VideoIcon, AwardIcon, FolderOpenIcon } from "lucide-react";

import { requireParentContext } from "@/lib/parent/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "More · TuitionTrack" };

const MORE_ITEMS = [
  {
    href: "/parent/ask",
    label: "Ask About My Child (AI)",
    description: "Instant fact-checked answers about academic performance",
    icon: SparklesIcon,
  },
  {
    href: "/parent/meetings",
    label: "Parent-Teacher Meetings",
    description: "Book conferences and review agreed action items",
    icon: VideoIcon,
  },
  {
    href: "/parent/portfolio",
    label: "Student Portfolio",
    description: "Verified academic work, distinction tests and projects",
    icon: AwardIcon,
  },
  {
    href: "/parent/syllabus",
    label: "Syllabus",
    description: "What has been taught vs what has been mastered",
    icon: BookOpenIcon,
  },
  {
    href: "/parent/assignments",
    label: "Assignments",
    description: "Set assignments, scores and feedback",
    icon: FileTextIcon,
  },
  {
    href: "/parent/tests",
    label: "Tests",
    description: "Test results, trends and subject performance",
    icon: BrainIcon,
  },
  {
    href: "/parent/attendance",
    label: "Attendance",
    description: "Day-by-day calendar and attendance rate",
    icon: CalendarCheckIcon,
  },
  {
    href: "/parent/calendar",
    label: "Calendar",
    description: "Upcoming homework, tests and fee dates",
    icon: CalendarDaysIcon,
  },
  {
    href: "/parent/messages",
    label: "Messages",
    description: "Announcements from the teacher",
    icon: MegaphoneIcon,
  },
  {
    href: "/parent/documents",
    label: "Document Center",
    description: "Official report cards, receipts and learning resources",
    icon: FolderOpenIcon,
  },
  {
    href: "/parent/notifications",
    label: "Notifications",
    description: "Your account activity and events",
    icon: BellIcon,
  },
  {
    href: "/parent/reports",
    label: "Reports",
    description: "Generated weekly, monthly and official report cards",
    icon: BarChart3Icon,
  },
  {
    href: "/parent/profile",
    label: "Profile",
    description: "Your account and linked children",
    icon: UserIcon,
  },
  {
    href: "/parent/support",
    label: "Support",
    description: "Help, FAQs and WhatsApp contact",
    icon: LifeBuoyIcon,
  },
] as const;

export default async function ParentMorePage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const requested = typeof searchParams?.child === "string" ? searchParams.child : undefined;
  await requireParentContext(requested);

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950">More</h1>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        {MORE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                <Icon className="size-5 text-slate-600" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                <p className="text-xs text-slate-400">{item.description}</p>
              </div>
              <ChevronRightIcon className="size-4 shrink-0 text-slate-300" aria-hidden />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

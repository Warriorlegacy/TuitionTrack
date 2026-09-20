import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCapIcon, SparklesIcon } from "lucide-react";
import { requireStudentContext } from "@/lib/student/auth";
import { StudentSidebar, StudentBottomNav } from "@/components/student/student-nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Student Portal · TuitionTrack",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireStudentContext();

  const userName = context.student?.name ?? context.profile?.name ?? "Student";
  const userEmail = context.user?.email ?? "";
  const studentClass = context.student?.class;

  if (!context.student) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md border-amber-200 bg-white shadow-soft">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
              <GraduationCapIcon className="size-6" />
            </div>
            <CardTitle className="text-lg font-bold text-slate-900">
              No Student Profile Linked
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              This account does not have an active student portal link yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs text-slate-600">
            <p>
              Please open the unique <strong>Student Portal Link</strong> provided by your tuition teacher, or ask them to generate your portal access link.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Back to Home
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1640px]">
        {/* Desktop Sidebar */}
        <aside className="hidden w-80 flex-none p-4 lg:block">
          <div className="sticky top-4 h-[calc(100vh-2rem)]">
            <StudentSidebar
              userName={userName}
              userEmail={userEmail}
              studentClass={studentClass}
            />
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex min-h-screen flex-1 flex-col pb-20 lg:pb-8">
          {/* Header */}
          <header className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white/70 px-4 py-3 backdrop-blur-lg sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">
                Student Learning Portal
              </p>
              <h1 className="truncate text-sm font-semibold text-slate-950">
                {context.student.name} · Class {context.student.class}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/app/tutor"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "gap-1.5 text-xs text-primary border-primary/20 bg-primary/5 hover:bg-primary/10",
                })}
              >
                <SparklesIcon className="size-3.5" />
                <span>AI Tutor</span>
              </Link>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <StudentBottomNav />
    </div>
  );
}

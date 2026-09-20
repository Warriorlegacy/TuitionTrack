import Link from "next/link";
import {
  HeartHandshakeIcon,
  GraduationCapIcon,
  ArrowRightIcon,
  Link2Icon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export function PortalAccessDashboardCard({
  stats,
}: {
  stats: {
    parentsActive: number;
    parentsPending: number;
    studentsActive: number;
    studentsPending: number;
  };
}) {
  return (
    <Card className="border-sky-200/70 bg-gradient-to-br from-white via-sky-50/30 to-emerald-50/20 shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Link2Icon className="size-4" />
          </div>
          <CardTitle className="text-sm font-semibold">Portal Access</CardTitle>
        </div>
        <Link
          href="/app/portal-access"
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "h-7 gap-1 text-xs text-primary font-medium",
          })}
        >
          Manage
          <ArrowRightIcon className="size-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3 pt-1">
        <div className="grid grid-cols-2 gap-3">
          {/* Parents */}
          <div className="rounded-xl border border-sky-100 bg-white/80 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <HeartHandshakeIcon className="size-3.5 text-sky-600" />
              <span>Parents</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-900">{stats.parentsActive}</span>
              <span className="text-[11px] text-emerald-600 font-medium">active</span>
              <span className="text-[11px] text-slate-400">· {stats.parentsPending} pending</span>
            </div>
          </div>

          {/* Students */}
          <div className="rounded-xl border border-emerald-100 bg-white/80 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <GraduationCapIcon className="size-3.5 text-emerald-600" />
              <span>Students</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-900">{stats.studentsActive}</span>
              <span className="text-[11px] text-emerald-600 font-medium">active</span>
              <span className="text-[11px] text-slate-400">· {stats.studentsPending} pending</span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          Share unique, secure access links with families so they can monitor attendance, homework, test marks, and academic mastery.
        </p>
      </CardContent>
    </Card>
  );
}

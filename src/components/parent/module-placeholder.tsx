import Link from "next/link";
import { ConstructionIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";

/**
 * Honest placeholder for a route that exists but has no data source wired yet.
 *
 * This component exists specifically so that unfinished screens say so, rather
 * than rendering zeros or fabricated figures. The brief's section 111 forbids
 * hard-coded progress, attendance, marks and teacher comments; a placeholder
 * that names the reason is the only honest option in between.
 */
export function ModulePlaceholder({
  title,
  description,
  /** What this screen will show, once its data source is wired. */
  willShow,
  /** Why it is not showing that yet. */
  reason,
}: {
  title: string;
  description: string;
  willShow: string[];
  reason: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      <Card className="rounded-2xl border-dashed border-slate-300 bg-white p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <ConstructionIcon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">
              This section is not live yet
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{reason}</p>

            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              When it goes live it will show
            </p>
            <ul className="mt-2 space-y-1.5">
              {willShow.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <p className="px-1 text-xs leading-relaxed text-slate-500">
        We would rather show you nothing than show you a number we cannot stand behind.{" "}
        <Link href="/parent/support" className="font-medium text-primary underline-offset-2 hover:underline">
          Contact support
        </Link>{" "}
        if you need this information urgently — your tuition teacher can share it directly.
      </p>
    </div>
  );
}

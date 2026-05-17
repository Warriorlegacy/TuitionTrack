import Link from "next/link";
import { GraduationCapIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("inline-flex items-center gap-3 text-slate-950", className)}
    >
      <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
        <GraduationCapIcon className="size-5" />
      </span>
      <span>
        <span className="block text-base font-semibold leading-none">TuitionTrack</span>
        <span className="mt-1 block text-xs font-medium text-slate-500">
          Homework. Fees. Progress.
        </span>
      </span>
    </Link>
  );
}

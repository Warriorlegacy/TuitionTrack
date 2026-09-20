"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CheckIcon, ChevronDownIcon, GraduationCapIcon } from "lucide-react";
import { useState, useTransition } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type SwitcherChild = {
  id: string;
  name: string;
  className: string;
};

/**
 * Multi-child switcher.
 *
 * Switching a child navigates with `?child=<id>`. The server validates that id
 * against the caller's own linked children before reading anything, so a
 * tampered id degrades to the first child rather than leaking another family's
 * data. Switching does not sign the parent out — it is a navigation, not a
 * session change (brief section 7).
 *
 * The switcher preserves the current path so a parent on /parent/tests stays on
 * tests when switching children.
 */
export function ChildSwitcher({
  kids,
  activeChildId,
}: {
  /** Deliberately not named `children`: this is data, not nested JSX. */
  kids: SwitcherChild[];
  activeChildId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const active = kids.find((k) => k.id === activeChildId) ?? kids[0] ?? null;

  if (kids.length === 0) return null;

  // A single child needs no switcher — showing one would be noise.
  if (kids.length === 1 && active) {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2">
        <GraduationCapIcon className="size-4 text-slate-400" aria-hidden />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">{active.name}</p>
          <p className="text-xs text-slate-500">Class {active.className}</p>
        </div>
      </div>
    );
  }

  function select(childId: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("child", childId);
    setOpen(false);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-left transition-colors hover:border-slate-300",
          isPending && "opacity-60",
        )}
        aria-label="Switch child"
      >
        <GraduationCapIcon className="size-4 text-slate-400" aria-hidden />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">
            {active?.name ?? "Select a child"}
          </p>
          <p className="text-xs text-slate-500">
            {active ? `Class ${active.className}` : `${kids.length} children`}
          </p>
        </div>
        <ChevronDownIcon className="size-4 text-slate-400" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Switch child</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {kids.map((kid) => (
          <DropdownMenuItem
            key={kid.id}
            onSelect={() => select(kid.id)}
            className="flex items-center justify-between gap-3"
          >
            <div className="leading-tight">
              <p className="text-sm font-medium text-slate-900">{kid.name}</p>
              <p className="text-xs text-slate-500">Class {kid.className}</p>
            </div>
            {kid.id === activeChildId && (
              <CheckIcon className="size-4 text-primary" aria-hidden />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

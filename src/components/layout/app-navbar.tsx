"use client";

import { MenuIcon, ChevronRightIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { roleLabels, routeTitles } from "@/lib/constants";
import type { AppRole } from "@/lib/db/types";
import { Button } from "@/components/ui/button";

export function AppNavbar({
  role,
  userName,
  onOpenMenu,
}: {
  role: AppRole;
  userName: string;
  onOpenMenu: () => void;
}) {
  const pathname = usePathname();
  const title = routeTitles[pathname] ?? "TuitionTrack";

  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-200/80 bg-white/70 px-4 py-4 backdrop-blur-lg sm:px-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon-sm" className="lg:hidden" onClick={onOpenMenu}>
          <MenuIcon />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">{roleLabels[role]} workspace</span>
          <ChevronRightIcon className="size-3 text-slate-300" />
          <h1 className="text-sm font-semibold text-slate-950">{title}</h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-full bg-primary/8 px-3.5 py-1.5 text-xs font-semibold text-primary sm:flex">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          {userName}
        </div>
      </div>
    </header>
  );
}

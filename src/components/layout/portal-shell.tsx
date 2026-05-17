"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { NavItem } from "@/lib/constants";
import type { AppRole } from "@/lib/db/types";
import { AppNavbar } from "@/components/layout/app-navbar";
import { AppSidebar } from "@/components/layout/app-sidebar";

export function PortalShell({
  navItems,
  role,
  userName,
  userEmail,
  children,
}: {
  navItems: NavItem[];
  role: AppRole;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1640px]">
        <aside className="hidden w-80 flex-none p-4 lg:block">
          <AppSidebar
            navItems={navItems}
            roleLabel={role}
            userName={userName}
            userEmail={userEmail}
          />
        </aside>
        <div className="flex min-h-screen flex-1 flex-col">
          <AppNavbar role={role} userName={userName} onOpenMenu={() => setOpen(true)} />
          <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-80 border-r-0 bg-transparent p-2 shadow-none">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <AppSidebar
            navItems={navItems}
            roleLabel={role}
            userName={userName}
            userEmail={userEmail}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

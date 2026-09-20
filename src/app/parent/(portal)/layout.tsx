import type { Metadata } from "next";

import { ChildSwitcher } from "@/components/parent/child-switcher";
import { ParentBottomNav, ParentSidebar } from "@/components/parent/parent-nav";
import { requireParentContext } from "@/lib/parent/auth";
import { parentNav } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Parent Portal · TuitionTrack",
  // The portal is per-family and must never be indexed.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Parent portal shell.
 *
 * The active child is read from `?child=` and validated server-side against the
 * caller's own linked children (`requireParentContext`), then passed down so the
 * switcher and the page agree on which child is in view. No child id from the
 * client is ever used to query data directly.
 */
export default async function ParentLayout({
  children,
  searchParams,
}: {
  children: React.ReactNode;
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const requested = typeof searchParams?.child === "string" ? searchParams.child : undefined;
  const context = await requireParentContext(requested);

  const switcherChildren = context.children.map((c) => ({
    id: c.student.id,
    name: c.student.name,
    className: c.student.class,
  }));

  const userName = context.profile?.name ?? context.user?.email ?? "Parent";
  const userEmail = context.user?.email ?? "";

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1640px]">
        <aside className="hidden w-80 flex-none p-4 lg:block">
          <div className="sticky top-4 h-[calc(100vh-2rem)]">
            <ParentSidebar navItems={parentNav} userName={userName} userEmail={userEmail} />
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white/70 px-4 py-3 backdrop-blur-lg sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                Parent Portal
              </p>
              <h1 className="truncate text-sm font-semibold text-slate-950">
                {context.children.length === 0
                  ? "No child linked yet"
                  : context.children.length === 1
                    ? context.children[0].student.name
                    : `${context.children.length} children linked`}
              </h1>
            </div>
            <ChildSwitcher
              kids={switcherChildren}
              activeChildId={context.activeChild?.student.id ?? null}
            />
          </header>

          {/* Bottom padding clears the fixed mobile nav. */}
          <main className="flex-1 px-4 py-6 pb-28 sm:px-6 lg:pb-6">{children}</main>
        </div>
      </div>

      <ParentBottomNav navItems={parentNav} />
    </div>
  );
}

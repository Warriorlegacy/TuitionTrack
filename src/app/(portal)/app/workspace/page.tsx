import { requireTeacherContext } from "@/lib/auth";
import { getWorkspaceContextForUser, listWorkspaceMembers } from "@/lib/workspace/auth";
import { PageHeader } from "@/components/shared/page-header";
import { WorkspaceSettingsCard } from "@/components/workspace/workspace-settings-card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UsersIcon, ArrowRightIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Workspace Settings · TuitionTrack",
};

export default async function WorkspacePage() {
  const context = await requireTeacherContext();
  if (!context?.user) return null;

  const wsContext = await getWorkspaceContextForUser(context.user.id);
  const workspace = wsContext.workspace;

  if (!workspace) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Workspace Settings"
          description="Manage your classroom workspace, unique join code, and student access."
        />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          No active workspace found for your account. Please contact support.
        </div>
      </div>
    );
  }

  const { members } = await listWorkspaceMembers(workspace.id, context.user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Workspace Settings"
          description="Manage your classroom workspace, unique join code, and student access."
        />
        <Link href="/app/workspace/members">
          <Button variant="outline" className="gap-2 bg-white border-slate-200 shadow-sm">
            <UsersIcon className="size-4 text-primary" />
            <span>Manage Members ({members.length})</span>
            <ArrowRightIcon className="size-3.5 text-slate-400" />
          </Button>
        </Link>
      </div>

      <WorkspaceSettingsCard
        workspace={workspace}
        memberCount={members.length}
      />
    </div>
  );
}

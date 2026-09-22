import { requireTeacherContext } from "@/lib/auth";
import { getWorkspaceContextForUser, listWorkspaceMembers } from "@/lib/workspace/auth";
import { PageHeader } from "@/components/shared/page-header";
import { WorkspaceMembersTable } from "@/components/workspace/workspace-members-table";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Workspace Members · TuitionTrack",
};

export default async function WorkspaceMembersPage() {
  const context = await requireTeacherContext();
  if (!context?.user) return null;

  const wsContext = await getWorkspaceContextForUser(context.user.id);
  const workspace = wsContext.workspace;

  if (!workspace) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Workspace Members"
          description="View and manage member roles in your classroom workspace."
        />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          No active workspace found for your account.
        </div>
      </div>
    );
  }

  const { members } = await listWorkspaceMembers(workspace.id, context.user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Workspace Members"
          description={`Manage students, parents, and teachers in ${workspace.name}.`}
        />
        <Link href="/app/workspace">
          <Button variant="outline" size="sm" className="gap-1.5 bg-white border-slate-200">
            <ArrowLeftIcon className="size-3.5" />
            <span>Back to Workspace Settings</span>
          </Button>
        </Link>
      </div>

      <WorkspaceMembersTable
        workspaceId={workspace.id}
        initialMembers={members}
        ownerId={workspace.owner_id}
      />
    </div>
  );
}

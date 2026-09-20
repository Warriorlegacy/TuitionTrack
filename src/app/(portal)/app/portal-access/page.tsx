import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth";
import { canAccessRoute } from "@/lib/constants";
import { getTeacherPortalAccessOverview } from "@/lib/portal-access/grants";
import { PageHeader } from "@/components/shared/page-header";
import { PortalAccessManager } from "@/components/portal-access/portal-access-manager";

export const dynamic = "force-dynamic";

export default async function PortalAccessPage() {
  const context = await requireAuthContext();
  if (!canAccessRoute(context.role, "/app/portal-access") || !context.canManage) {
    redirect("/app/dashboard");
  }

  const { students, stats } = await getTeacherPortalAccessOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portal Access"
        description="Give parents and students secure access to their TuitionTrack portals."
      />
      <PortalAccessManager students={students} stats={stats} />
    </div>
  );
}

import { redirect } from "next/navigation";
import { canAccessRoute } from "@/lib/constants";
import { requireAuthContext } from "@/lib/auth";
import { getAnnouncementsPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { AnnouncementsPanel } from "@/components/announcements/announcements-panel";

export default async function AnnouncementsPage() {
  const context = await requireAuthContext();
  if (!canAccessRoute(context.role, "/app/announcements")) {
    redirect("/app/dashboard");
  }

  const data = await getAnnouncementsPageData(context);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Broadcast updates once and keep parent communication consistent."
      />
      <AnnouncementsPanel announcements={data.announcements} canManage={context.canManage} />
    </div>
  );
}

import { redirect } from "next/navigation";
import { canAccessRoute } from "@/lib/constants";
import { requireAuthContext } from "@/lib/auth";
import { getAnnouncementsPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { AnnouncementsPanel } from "@/components/announcements/announcements-panel";
import { SparklesIcon } from "lucide-react";

export default async function AnnouncementsPage() {
  const context = await requireAuthContext();
  if (!canAccessRoute(context.role, "/app/announcements")) {
    redirect("/app/dashboard");
  }

  const data = await getAnnouncementsPageData(context);

  const aiInsight = context.canManage
    ? "Use AI to draft announcements faster. Connect a free AI key in Settings to unlock AI writing assistance."
    : "Stay updated with the latest announcements from your tutor.";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Broadcast updates once and keep parent communication consistent."
      />
      <div className="flex items-start gap-2 rounded-tt-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <SparklesIcon className="size-4 shrink-0" aria-hidden />
        <span>{aiInsight}</span>
      </div>
      <AnnouncementsPanel announcements={data.announcements} canManage={context.canManage} />
    </div>
  );
}

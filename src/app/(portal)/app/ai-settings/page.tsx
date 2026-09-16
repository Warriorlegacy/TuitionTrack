import { requireAuthContext } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { AiSettings } from "@/components/settings/ai-settings";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  await requireAuthContext();

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Settings"
        description="Manage your AI provider keys, preferences, and free-tier options."
      />
      <AiSettings />
    </div>
  );
}

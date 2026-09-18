import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { ApprovalsView } from "@/components/automation/approvals-view";

export default async function ApprovalsPage() {
  const context = await requireAuthContext();
  if (!context.canManage) redirect("/app/dashboard");

  const supabase = createSupabaseServerClient();
  const [{ data: approvals }, { data: runs }, { data: rules }] = await Promise.all([
    supabase
      .from("approvals")
      .select("id, org_id, kind, preview, status, created_at, payload")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50),
    supabase
      .from("agent_runs")
      .select("id, agent, trigger, status, cost_paise, model, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("automation_rules").select("org_id, agent, enabled, autonomy").limit(50),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Agent-drafted actions waiting for your yes. Clear it like an inbox."
      />
      <ApprovalsView
        approvals={(approvals ?? []) as unknown as React.ComponentProps<typeof ApprovalsView>["approvals"]}
        runs={(runs ?? []) as unknown as React.ComponentProps<typeof ApprovalsView>["runs"]}
        rules={(rules ?? []) as unknown as React.ComponentProps<typeof ApprovalsView>["rules"]}
      />
    </div>
  );
}

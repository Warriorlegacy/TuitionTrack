import { todayISO, type Db } from "./shared";

// Guide A12 Founder Brief: daily 06:30, L4, messages only the tutor.
// Five lines, plain text (WhatsApp-safe, no emojis): classes/work, attention,
// money, overnight failures, AI spend. Facts from SQL; no LLM in this step.

export type BriefCounts = {
  approvalsPending: number;
  homeworkDueToday: number;
  feesOverdue: number;
  feesOverdueRs: number;
  failedRuns: number;
  aiSpendRs: number;
  attention: string[];
};

function rs(paise: number): string {
  return `Rs ${Math.round(paise / 100)}`;
}

export async function buildFounderBrief(
  supabase: Db,
  today: Date = new Date(),
): Promise<{ markdown: string; counts: BriefCounts }> {
  const todayStr = todayISO(today);
  const since = new Date(today.getTime() - 86_400_000).toISOString();

  const [runsRes, tasksRes, approvalsRes, feesRes, hwRes, orgRes] = await Promise.all([
    supabase.from("agent_runs").select("agent, status, cost_paise").gte("created_at", since).limit(1000),
    supabase
      .from("tasks")
      .select("title, priority, source")
      .eq("status", "open")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("approvals")
      .select("id")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100),
    supabase.from("fees").select("amount").neq("status", "paid").lt("due_date", todayStr).limit(500),
    supabase.from("homework").select("id").eq("due_date", todayStr).limit(500),
    supabase.from("orgs").select("id").limit(1).maybeSingle(),
  ]);

  const runs = ((runsRes.data ?? []) as unknown as { agent: string; status: string; cost_paise: number | null }[]);
  const tasks = ((tasksRes.data ?? []) as unknown as { title: string; priority: number; source: string | null }[]);
  const approvals = ((approvalsRes.data ?? []) as unknown as { id: string }[]);
  const fees = ((feesRes.data ?? []) as unknown as { amount: number }[]);
  const hw = ((hwRes.data ?? []) as unknown as { id: string }[]);

  const failed = runs.filter((r) => r.status === "failed");
  const spend = runs.reduce((a, r) => a + (r.cost_paise ?? 0), 0);
  const attention = tasks.slice(0, 3).map((t) => t.title.slice(0, 70));

  const counts: BriefCounts = {
    approvalsPending: approvals.length,
    homeworkDueToday: hw.length,
    feesOverdue: fees.length,
    feesOverdueRs: fees.reduce((a, f) => a + (Number(f.amount) || 0), 0),
    failedRuns: failed.length,
    aiSpendRs: Math.round(spend / 100),
    attention,
  };

  const markdown = [
    `Today ${todayStr}: ${counts.homeworkDueToday} homework due, ${counts.approvalsPending} approvals waiting.`,
    `Attention: ${attention.length > 0 ? attention.join(" | ") : "nothing flagged — queue is clear."}`,
    `Fees: ${counts.feesOverdue} overdue totalling Rs ${counts.feesOverdueRs}.`,
    failed.length > 0
      ? `Overnight: ${failed.length} failed run(s) (${Array.from(new Set(failed.map((f) => f.agent))).join(", ")}).`
      : "Overnight: all quiet, no failed runs.",
    `AI spend (24h): ${rs(spend)}.`,
  ].join("\n");

  // agent_runs.org_id is NOT NULL — skip the log row when no org exists yet.
  const orgId = (orgRes.data as unknown as { id: string } | null)?.id ?? null;
  if (orgId) {
    await supabase.from("agent_runs").insert({
      org_id: orgId,
      agent: "brief",
      trigger: "cron",
      autonomy: "L4",
      status: "success",
      input: { date: todayStr },
      output: { markdown, ...counts },
    });
  }
  return { markdown, counts };
}

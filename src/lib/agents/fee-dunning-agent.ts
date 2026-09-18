import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

type Db = SupabaseClient<Database, "public">;

export type OverdueInvoice = {
  id: string;
  student_id: string;
  due_on: string; // ISO date
  status: string;
  amount?: number | null;
};

export type LadderItem = {
  invoiceId: string;
  studentId: string;
  step: 1 | 2 | 3;
  daysOverdue: number;
  dedupeKey: string;
};

const DAY_MS = 86_400_000;

// Reminder ladder (guide A9): day+3 soft, day+7 second, day+12 human call.
// Hard stop after two automated reminders — step 3 escalates to a task.
export function computeFeeLadder(
  invoices: OverdueInvoice[],
  today: Date = new Date(),
): LadderItem[] {
  const out: LadderItem[] = [];
  for (const inv of invoices) {
    const daysOverdue = Math.floor((today.getTime() - new Date(inv.due_on).getTime()) / DAY_MS);
    if (inv.status === "paid" || inv.status === "waived" || inv.status === "void") continue;
    let step: 1 | 2 | 3 | null = null;
    if (daysOverdue >= 12) step = 3;
    else if (daysOverdue >= 7) step = 2;
    else if (daysOverdue >= 3) step = 1;
    if (step === null) continue;
    out.push({
      invoiceId: inv.id,
      studentId: inv.student_id,
      step,
      daysOverdue,
      dedupeKey: `fee:${inv.id}:step${step}`,
    });
  }
  return out;
}

type StudentLite = {
  id: string;
  name: string;
  org_id: string | null;
  teacher_id: string;
  parent_phone: string | null;
};

async function resolveOrgId(supabase: Db, student: StudentLite): Promise<string | null> {
  if (student.org_id) return student.org_id;
  // Legacy row without org: fall back to the teacher's org.
  const { data } = await supabase
    .from("orgs")
    .select("id")
    .eq("created_by", student.teacher_id)
    .limit(1)
    .maybeSingle();
  return ((data as unknown as { id: string } | null)?.id ?? null);
}

function fillTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

/**
 * Fee dunning (guide A9). Numbers from SQL only — no LLM in this step;
 * message bodies render from message_templates + computed amount.
 * Step 1–2 → approvals rows (kind 'message', L3); step 3 → ops task
 * (human call). Never sends directly.
 */
export async function runFeeDunning(
  supabase: Db,
  today: Date = new Date(),
): Promise<{ drafted: number; escalated: number }> {
  const counts = { drafted: 0, escalated: 0 };
  const todayISO = today.toISOString().slice(0, 10);

  // Skip orgs where the fee agent (or everything) is switched off.
  // Absent rule row = enabled (guide default true).
  const { data: rules } = await supabase
    .from("automation_rules")
    .select("org_id, agent, enabled")
    .in("agent", ["fee", "global"]);
  const off = new Set(
    (((rules ?? []) as unknown as { org_id: string; enabled: boolean }[]))
      .filter((r) => r.enabled === false)
      .map((r) => r.org_id),
  );

  // Existing fees table: status paid|unpaid|overdue, due_date, amount.
  const { data: fees, error: feeErr } = await supabase
    .from("fees")
    .select("id, student_id, amount, status, due_date")
    .neq("status", "paid")
    .lt("due_date", todayISO)
    .limit(500);
  if (feeErr || !fees?.length) return counts;

  const feeRows = fees as unknown as {
    id: string;
    student_id: string;
    amount: number;
    status: string;
    due_date: string;
  }[];
  const studentIds = Array.from(new Set(feeRows.map((f) => f.student_id)));
  const { data: students } = await supabase
    .from("students")
    .select("id, name, org_id, teacher_id, parent_phone")
    .in("id", studentIds);
  const studentById = new Map(
    ((students ?? []) as unknown as StudentLite[]).map((s) => [s.id, s]),
  );

  const ladder = computeFeeLadder(
    feeRows.map((f) => ({ id: f.id, student_id: f.student_id, due_on: f.due_date, status: f.status })),
    today,
  );
  if (ladder.length === 0) return counts;

  // Idempotency: skip dedupe keys already drafted (any status).
  const { data: existing } = await supabase
    .from("approvals")
    .select("payload")
    .eq("kind", "message")
    .limit(1000);
  const seen = new Set(
    ((existing ?? []) as unknown as { payload: { dedupe_key?: string } }[])
      .map((r) => r.payload?.dedupe_key)
      .filter((k): k is string => !!k),
  );

  // Optional templates; fall back to inline copy when absent.
  const { data: templates } = await supabase
    .from("message_templates")
    .select("key, body")
    .eq("active", true)
    .in("key", ["fee_reminder_1", "fee_reminder_2"])
    .limit(4);
  const tpl = new Map(
    ((templates ?? []) as unknown as { key: string; body: string }[]).map((t) => [t.key, t.body]),
  );
  const fallback: Record<number, string> = {
    1: "Namaste, fee of Rs {{amount}} for {{student}} was due {{days}} days ago. Pay here: {{link}}",
    2: "Reminder: Rs {{amount}} for {{student}} is {{days}} days overdue. Please clear it this week: {{link}}",
  };

  const runRow = {
    org_id: null as string | null,
    agent: "fee",
    trigger: "cron",
    autonomy: "L3",
    status: "success",
    input: { overdue_count: ladder.length, date: todayISO },
    output: null as null | { drafted: number; escalated: number },
  };

  for (const item of ladder) {
    if (seen.has(item.dedupeKey)) continue;
    const student = studentById.get(item.studentId);
    if (!student) continue;
    const orgId = await resolveOrgId(supabase, student);
    if (!orgId || off.has(orgId)) continue;
    const fee = feeRows.find((f) => f.id === item.invoiceId);
    const amount = String(fee?.amount ?? "");
    if (runRow.org_id === null) runRow.org_id = orgId;

    if (item.step === 3) {
      await supabase.from("tasks").insert({
        org_id: orgId,
        title: `Call family: fee ${item.daysOverdue}d overdue (${student.name})`,
        detail: `Fee record ${item.invoiceId}, Rs ${amount}. Two reminders sent; per policy the third step is a human call.`,
        priority: 2,
        due_on: todayISO,
        subject_type: "student",
        subject_id: student.id,
        source: "fee",
        status: "open",
      });
      seen.add(item.dedupeKey);
      counts.escalated += 1;
      continue;
    }

    const body = fillTemplate(
      tpl.get(`fee_reminder_${item.step}`) ?? fallback[item.step],
      { amount, student: student.name, days: String(item.daysOverdue), link: "in app" },
    );
    const { data: run } = await supabase
      .from("agent_runs")
      .insert({
        org_id: orgId,
        agent: "fee",
        trigger: "cron",
        autonomy: "L3",
        status: "success",
        input: { invoice_id: item.invoiceId, step: item.step },
      })
      .select("id")
      .maybeSingle();
    await supabase.from("approvals").insert({
      org_id: orgId,
      agent_run_id: (run as unknown as { id: string } | null)?.id ?? null,
      kind: "message",
      payload: {
        channel: "whatsapp",
        recipient_type: "parent",
        to: student.parent_phone,
        body,
        dedupe_key: item.dedupeKey,
        template_key: `fee_reminder_${item.step}`,
        invoice_id: item.invoiceId,
        student_id: student.id,
        amount,
      },
      preview: body,
      status: "pending",
    });
    seen.add(item.dedupeKey);
    counts.drafted += 1;
  }

  if (runRow.org_id) {
    await supabase.from("agent_runs").insert({ ...runRow, output: { ...counts } });
  }
  return counts;
}

import { chunk, disabledOrgIds, orgResolver, todayISO, type Db } from "./shared";

// Guide A3 Schedule + Attendance: L4 to record and confirm, L3 to propose
// anything that moves the calendar. Three-plus absences in a fortnight, or a
// reason hinting at illness/family trouble, escalates to a task — never an
// automated message. (No class_sessions table exists yet, so the morning
// schedule is computed from students + homework due + attendance.)

export function trailingAbsences(rows: { date: string; present: boolean }[]): number {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  let n = 0;
  for (const r of sorted) {
    if (!r.present) n += 1;
    else break;
  }
  return n;
}

export function buildMorningSchedule(input: {
  date: string;
  studentCount: number;
  homeworkDue: number;
  absentYesterday: string[];
  approvalsPending: number;
}): string {
  const absent =
    input.absentYesterday.length > 0
      ? `Absent yesterday: ${input.absentYesterday.slice(0, 5).join(", ")}${
          input.absentYesterday.length > 5 ? ` +${input.absentYesterday.length - 5} more` : ""
        }.`
      : "Absent yesterday: none recorded.";
  return [
    `Schedule ${input.date}: ${input.studentCount} students on roll, ${input.homeworkDue} homework due today.`,
    absent,
    `Approvals waiting: ${input.approvalsPending} — clear before first class.`,
  ].join("\n");
}

type StudentLite = {
  id: string;
  name: string;
  org_id: string | null;
  teacher_id: string;
  parent_phone: string | null;
};

// L4 record: absence is written, then the ladder decides — 2nd consecutive
// unexplained absence drafts one gentle parent check-in (L3), 3+ absences in
// 14 days becomes a tutor task.
export async function recordAbsence(
  supabase: Db,
  input: { studentId: string; date: string; reason?: string },
): Promise<{ recorded: boolean; drafted: boolean; escalated: boolean }> {
  const done = { recorded: false, drafted: false, escalated: false };
  const { data: student } = await supabase
    .from("students")
    .select("id, name, org_id, teacher_id, parent_phone")
    .eq("id", input.studentId)
    .maybeSingle();
  const st = student as unknown as StudentLite | null;
  if (!st) return done;
  const orgId = await orgResolver(supabase)(st);
  if (!orgId) return done;
  const { data: rules } = await supabase
    .from("automation_rules")
    .select("org_id, agent, enabled")
    .eq("org_id", orgId)
    .in("agent", ["schedule", "global"]);
  if (
    disabledOrgIds(
      ((rules ?? []) as unknown as { org_id: string; agent: string; enabled: boolean }[]),
      ["schedule", "global"],
    ).has(orgId)
  ) {
    return done;
  }

  const { error } = await supabase.from("attendance").insert({
    student_id: st.id,
    date: input.date,
    present: false,
    teacher_id: st.teacher_id,
  });
  if (error) throw new Error(`attendance insert failed: ${error.message}`);
  done.recorded = true;

  const { data: recent } = await supabase
    .from("attendance")
    .select("date, present")
    .eq("student_id", st.id)
    .order("date", { ascending: false })
    .limit(14);
  const rows = ((recent ?? []) as unknown as { date: string; present: boolean }[]);
  const streak = trailingAbsences(rows);
  const absences14 = rows.filter((r) => !r.present).length;

  if (streak === 2 && !input.reason) {
    const dedupeKey = `absence:${st.id}:${input.date}`;
    const { data: existing } = await supabase
      .from("approvals")
      .select("id, payload")
      .eq("org_id", orgId)
      .eq("kind", "message")
      .limit(500);
    const dupe = ((existing ?? []) as unknown as { id: string; payload: { dedupe_key?: string } }[]).find(
      (r) => r.payload?.dedupe_key === dedupeKey,
    );
    if (!dupe) {
      const body = `Namaste, ${st.name} missed two classes in a row. Is everything alright? Reply here and we will arrange a make-up.`;
      const { data: run } = await supabase
        .from("agent_runs")
        .insert({ org_id: orgId, agent: "schedule", trigger: "event", autonomy: "L3", status: "success", input: { student_id: st.id, date: input.date } })
        .select("id")
        .maybeSingle();
      await supabase.from("approvals").insert({
        org_id: orgId,
        agent_run_id: (run as unknown as { id: string } | null)?.id ?? null,
        kind: "message",
        payload: {
          channel: "whatsapp",
          recipient_type: "parent",
          to: st.parent_phone,
          body,
          dedupe_key: dedupeKey,
          template_key: "absence_checkin",
          student_id: st.id,
        },
        preview: body,
        status: "pending",
      });
      done.drafted = true;
    }
  }
  if (absences14 >= 3) {
    await supabase.from("tasks").insert({
      org_id: orgId,
      title: `${absences14} absences in 14 days (${st.name})${input.reason ? ` — ${input.reason}` : ""}`,
      detail: `Second consecutive unexplained absence triggers a parent check-in; at 3+ in a fortnight this needs a human call, not a message.`,
      priority: 2,
      due_on: input.date,
      subject_type: "student",
      subject_id: st.id,
      source: "schedule",
      status: "open",
    });
    done.escalated = true;
  }
  return done;
}

// L3 propose: a make-up slot that moves the calendar drafts an approval.
export async function proposeMakeup(
  supabase: Db,
  input: { orgId: string; studentId: string; studentName: string; parentPhone: string | null; detail: string; slots: string[] },
  today: Date = new Date(),
): Promise<{ approvalId: string | null; deduped: boolean }> {
  const dedupeKey = `makeup:${input.studentId}:${todayISO(today)}`;
  const { data: existing } = await supabase
    .from("approvals")
    .select("id, payload")
    .eq("org_id", input.orgId)
    .eq("kind", "message")
    .limit(500);
  const dupe = ((existing ?? []) as unknown as { id: string; payload: { dedupe_key?: string } }[]).find(
    (r) => r.payload?.dedupe_key === dedupeKey,
  );
  if (dupe) return { approvalId: dupe.id, deduped: true };
  const body = `Make-up for ${input.studentName}: ${input.detail} Possible slots: ${input.slots.join(", ")}.`;
  const { data: run } = await supabase
    .from("agent_runs")
    .insert({ org_id: input.orgId, agent: "schedule", trigger: "manual", autonomy: "L3", status: "success", input: { student_id: input.studentId, slots: input.slots } })
    .select("id")
    .maybeSingle();
  const { data: approval } = await supabase
    .from("approvals")
    .insert({
      org_id: input.orgId,
      agent_run_id: (run as unknown as { id: string } | null)?.id ?? null,
      kind: "message",
      payload: {
        channel: "whatsapp",
        recipient_type: "parent",
        to: input.parentPhone,
        body,
        dedupe_key: dedupeKey,
        template_key: "makeup_proposal",
        student_id: input.studentId,
      },
      preview: body,
      status: "pending",
    })
    .select("id")
    .maybeSingle();
  return { approvalId: (approval as unknown as { id: string } | null)?.id ?? null, deduped: false };
}

export async function runMorningSchedule(
  supabase: Db,
  today: Date = new Date(),
): Promise<{ markdown: string; counts: { students: number; homeworkDue: number; absentYesterday: number; approvalsPending: number } }> {
  const todayStr = todayISO(today);
  const yesterday = todayISO(new Date(today.getTime() - 86_400_000));
  const { data: rules } = await supabase
    .from("automation_rules")
    .select("org_id, agent, enabled")
    .in("agent", ["schedule", "global"]);
  const off = disabledOrgIds(
    ((rules ?? []) as unknown as { org_id: string; agent: string; enabled: boolean }[]),
    ["schedule", "global"],
  );

  const { data: students } = await supabase.from("students").select("id, name, org_id, teacher_id").limit(500);
  const list = ((students ?? []) as unknown as StudentLite[]).filter(
    (s) => s.org_id && !off.has(s.org_id),
  );
  const ids = list.map((s) => s.id);
  let hwDue = 0;
  const absentNames: string[] = [];
  for (const c of chunk(ids)) {
    if (c.length === 0) break;
    const [h, a] = await Promise.all([
      supabase.from("homework").select("id").in("student_id", c).eq("due_date", todayStr).limit(1000),
      supabase.from("attendance").select("student_id, present").in("student_id", c).eq("date", yesterday).eq("present", false).limit(500),
    ]);
    hwDue += ((h.data ?? []) as unknown as { id: string }[]).length;
    const byId = new Map(list.map((s) => [s.id, s.name]));
    for (const r of ((a.data ?? []) as unknown as { student_id: string }[])) {
      absentNames.push(byId.get(r.student_id) ?? "a student");
    }
  }
  const { data: approvals } = await supabase.from("approvals").select("id").eq("status", "pending").limit(100);
  const counts = {
    students: list.length,
    homeworkDue: hwDue,
    absentYesterday: absentNames.length,
    approvalsPending: ((approvals ?? []) as unknown as { id: string }[]).length,
  };
  const markdown = buildMorningSchedule({
    date: todayStr,
    studentCount: counts.students,
    homeworkDue: counts.homeworkDue,
    absentYesterday: absentNames,
    approvalsPending: counts.approvalsPending,
  });

  const { data: org } = await supabase.from("orgs").select("id").limit(1).maybeSingle();
  const orgId = (org as unknown as { id: string } | null)?.id ?? null;
  if (orgId && !off.has(orgId)) {
    await supabase.from("agent_runs").insert({
      org_id: orgId,
      agent: "schedule",
      trigger: "cron",
      autonomy: "L4",
      status: "success",
      input: { date: todayStr },
      output: { markdown, ...counts },
    });
  }
  return { markdown, counts };
}

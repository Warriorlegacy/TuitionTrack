import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type HighRiskRecord = {
  student_id: string;
  risk_level: string;
  risk_score: number;
  attendance_pct: number;
  homework_pct: number;
  student_name: string;
  student_class: string;
  teacher_id: string;
  teacher_email: string;
  teacher_name: string;
};

type ParentDigestRecord = {
  student_id: string;
  student_name: string;
  parent_email: string;
  parent_name: string;
  teacher_name: string;
  classes_total: number;
  classes_attended: number;
  hw_total: number;
  hw_completed: number;
  test_scores: { subject: string; marks: number; total: number }[] | null;
};

const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tuitiontrack-app.vercel.app";

/**
 * Weekly sync (blueprint #30): Monday tutor high-risk alerts + parent digests.
 *
 * Aggregation now happens in-database via the RPCs in
 * `20260916000000_weekly_sync_rpcs.sql`. This route previously POSTed raw SQL to
 * the Supabase *Management* API with the service_role key, which always 401'd
 * (that endpoint needs a Personal Access Token) — and because the error object
 * was treated as a record array, it returned `success: true` while sending
 * nothing. Failures now surface instead of hiding.
 */
export async function GET(request: Request) {
  // Fail closed: without CRON_SECRET the `x-vercel-cron` header alone is
  // spoofable by any caller, so an unconfigured secret must not open the route.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  const authorized =
    request.headers.get("Authorization") === `Bearer ${cronSecret}` ||
    request.headers.get("x-vercel-cron") === "1";
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "Resend API key not configured" }, { status: 500 });
  }

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  try {
    // ── Data ────────────────────────────────────────────────────────────
    const [{ data: highRisk, error: hrErr }, { data: digests, error: pdErr }] = await Promise.all([
      supabase.rpc("weekly_high_risk_students"),
      supabase.rpc("weekly_parent_digests"),
    ]);

    if (hrErr) {
      return NextResponse.json({ error: `high-risk query failed: ${hrErr.message}` }, { status: 500 });
    }
    if (pdErr) {
      return NextResponse.json({ error: `parent digest query failed: ${pdErr.message}` }, { status: 500 });
    }

    const highRiskRecords = (highRisk ?? []) as unknown as HighRiskRecord[];
    const parentDigestRecords = (digests ?? []) as unknown as ParentDigestRecord[];

    // ── Task A: tutor high-risk alerts, one email per teacher ────────────
    const tutorSends: Promise<Response>[] = [];
    const teacherMap = new Map<string, HighRiskRecord[]>();
    for (const r of highRiskRecords) {
      const list = teacherMap.get(r.teacher_id) ?? [];
      list.push(r);
      teacherMap.set(r.teacher_id, list);
    }

    for (const students of Array.from(teacherMap.values())) {
      const teacherEmail = students[0].teacher_email;
      if (!teacherEmail) continue;
      const teacherName = students[0].teacher_name || "Tutor";
      const html = `
        <div style="font-family: sans-serif; color: #333;">
          <h2 style="color: #dc2626;">⚠️ High-Risk Alert: Action Required</h2>
          <p>Hello ${teacherName},</p>
          <p>The following students have been identified as <strong>HIGH RISK</strong> this week:</p>
          <ul style="background: #fef2f2; padding: 20px; border-radius: 8px; border: 1px solid #fee2e2;">
            ${students
              .map(
                (s) => `
              <li style="margin-bottom: 12px;">
                <strong>${s.student_name}</strong> (Class ${s.student_class})<br/>
                Risk Score: ${s.risk_score}/100 | Attendance: ${s.attendance_pct}% | Homework: ${s.homework_pct}%
              </li>
            `,
              )
              .join("")}
          </ul>
          <p><a href="${PORTAL_URL}/app/reports" style="color: #2563eb;">View Detailed Reports</a></p>
        </div>
      `;

      tutorSends.push(
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "EduPulse AI Alerts <alerts@edupulse.ai>",
            to: [teacherEmail],
            subject: `⚠️ Action Required: ${students.length} High-Risk Students Detected`,
            html,
          }),
        }),
      );
    }

    // ── Task B: parent weekly digests ───────────────────────────────────
    const parentSends: Promise<Response>[] = [];
    for (const r of parentDigestRecords) {
      if (!r.parent_email) continue;
      if (r.classes_total === 0 && r.hw_total === 0 && (!r.test_scores || r.test_scores.length === 0)) continue;

      const html = `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background: #2563eb; color: white; padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px;">Weekly Progress Digest</h1>
            <p style="margin: 4px 0 0; opacity: 0.9;">${r.student_name} &bull; ${new Date().toLocaleDateString("en-IN", { month: "long", day: "numeric" })}</p>
          </div>
          <div style="padding: 24px;">
            <p>Hello ${r.parent_name || "Parent"},</p>
            <p>Here is a summary of ${r.student_name}'s activity in tuition classes this week:</p>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0;">
              <div style="background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center;">
                <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Attendance</div>
                <div style="font-size: 24px; font-weight: bold; color: #0f172a;">${r.classes_attended}/${r.classes_total}</div>
              </div>
              <div style="background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center;">
                <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Homework</div>
                <div style="font-size: 24px; font-weight: bold; color: #0f172a;">${r.hw_completed}/${r.hw_total}</div>
              </div>
            </div>

            ${
              r.test_scores && r.test_scores.length > 0
                ? `
              <h3 style="font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Recent Test Results</h3>
              <table style="width: 100%; border-collapse: collapse;">
                ${r.test_scores
                  .map(
                    (t) => `
                  <tr>
                    <td style="padding: 8px 0; color: #475569;">${t.subject}</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600;">${t.marks}/${t.total}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </table>
            `
                : ""
            }

            <p style="margin-top: 32px; font-size: 14px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 24px;">
              Generated by EduPulse AI for ${r.teacher_name}'s Classes.<br/>
              Login to the <a href="${PORTAL_URL}" style="color: #2563eb;">Parent Portal</a> for full history.
            </p>
          </div>
        </div>
      `;

      parentSends.push(
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "EduPulse AI Digests <reports@edupulse.ai>",
            to: [r.parent_email],
            subject: `Weekly Update: ${r.student_name}'s Performance`,
            html,
          }),
        }),
      );
    }

    const results = await Promise.allSettled([...tutorSends, ...parentSends]);
    const failed = results.filter((r) => r.status === "rejected").length;
    const rejectedByApi = results.filter(
      (r) => r.status === "fulfilled" && !(r.value as Response).ok,
    ).length;

    return NextResponse.json({
      success: failed === 0 && rejectedByApi === 0,
      tutor_alerts: tutorSends.length,
      parent_digests: parentSends.length,
      failed,
      rejected_by_api: rejectedByApi,
      ...(rejectedByApi > 0
        ? { hint: "Some sends were rejected — check the Resend domain and API key." }
        : {}),
    });
  } catch (err) {
    console.error("Unhandled error in weekly-sync cron:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

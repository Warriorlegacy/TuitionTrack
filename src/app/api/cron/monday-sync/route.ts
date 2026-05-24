import { NextResponse } from "next/server";

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

export async function GET(request: Request) {
  try {
    // 1. Verify this request is from Vercel Cron
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && request.headers.get("x-vercel-cron") !== "1") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const projectRef = supabaseUrl.replace("https://", "").split(".")[0];
    const resendKey = process.env.RESEND_API_KEY;

    if (!resendKey) {
      return NextResponse.json({ error: "Resend API key not configured" }, { status: 500 });
    }

    // --- TASK A: TUTOR HIGH-RISK ALERTS ---
    
    const tutorQuery = `
      SELECT 
        pr.student_id, pr.risk_level, pr.risk_score, pr.attendance_pct, pr.homework_pct,
        s.name as student_name, s.class as student_class,
        u.id as teacher_id, u.email as teacher_email, u.name as teacher_name
      FROM public.performance_records pr
      JOIN public.students s ON pr.student_id = s.id
      JOIN public.users u ON s.teacher_id = u.id
      WHERE pr.risk_level = 'high'
      AND pr.created_at >= (now() - interval '7 days');
    `;

    const tutorResponse = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({ query: tutorQuery }),
    });

    const highRiskRecords = (await tutorResponse.json()) as HighRiskRecord[];

    // --- TASK B: WEEKLY PARENT DIGESTS ---

    const parentQuery = `
      SELECT 
        s.id as student_id, s.name as student_name, s.parent_email, s.parent_name,
        u.name as teacher_name,
        (SELECT count(*) FROM public.attendance a WHERE a.student_id = s.id AND a.date >= (now() - interval '7 days')) as classes_total,
        (SELECT count(*) FROM public.attendance a WHERE a.student_id = s.id AND a.date >= (now() - interval '7 days') AND a.present = true) as classes_attended,
        (SELECT count(*) FROM public.homework h WHERE h.student_id = s.id AND h.due_date >= (now() - interval '7 days')) as hw_total,
        (SELECT count(*) FROM public.homework h WHERE h.student_id = s.id AND h.due_date >= (now() - interval '7 days') AND h.status = 'completed') as hw_completed,
        (SELECT json_agg(t) FROM (SELECT subject, marks, total FROM public.tests WHERE student_id = s.id AND date >= (now() - interval '7 days')) t) as test_scores
      FROM public.students s
      JOIN public.users u ON s.teacher_id = u.id
      WHERE s.parent_email IS NOT NULL AND s.parent_email != '';
    `;

    const parentResponse = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({ query: parentQuery }),
    });

    const parentDigestRecords = (await parentResponse.json()) as ParentDigestRecord[];

    // --- EXECUTE TASK A: SEND TUTOR EMAILS ---

    const tutorPromises = [];
    if (highRiskRecords && highRiskRecords.length > 0) {
      const teacherMap = new Map<string, HighRiskRecord[]>();
      highRiskRecords.forEach(r => {
        if (!teacherMap.has(r.teacher_id)) teacherMap.set(r.teacher_id, []);
        teacherMap.get(r.teacher_id)!.push(r);
      });

      const teacherValues = Array.from(teacherMap.values());
      for (const students of teacherValues) {
        const teacherEmail = students[0].teacher_email;
        const teacherName = students[0].teacher_name || "Tutor";
        const html = `
          <div style="font-family: sans-serif; color: #333;">
            <h2 style="color: #dc2626;">⚠️ High-Risk Alert: Action Required</h2>
            <p>Hello ${teacherName},</p>
            <p>The following students have been identified as <strong>HIGH RISK</strong> this week:</p>
            <ul style="background: #fef2f2; padding: 20px; border-radius: 8px; border: 1px solid #fee2e2;">
              ${students.map(s => `
                <li style="margin-bottom: 12px;">
                  <strong>${s.student_name}</strong> (Class ${s.student_class})<br/>
                  Risk Score: ${s.risk_score}/100 | Attendance: ${s.attendance_pct}% | Homework: ${s.homework_pct}%
                </li>
              `).join("")}
            </ul>
            <p><a href="https://tuitiontrack-app.vercel.app/app/reports" style="color: #2563eb;">View Detailed Reports</a></p>
          </div>
        `;
        tutorPromises.push(fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "EduPulse AI Alerts <alerts@edupulse.ai>",
            to: [teacherEmail],
            subject: `⚠️ Action Required: ${students.length} High-Risk Students Detected`,
            html,
          }),
        }));
      }
    }

    // --- EXECUTE TASK B: SEND PARENT EMAILS ---

    const parentPromises = [];
    if (parentDigestRecords && parentDigestRecords.length > 0) {
      for (const r of parentDigestRecords) {
        if (r.classes_total === 0 && r.hw_total === 0 && (!r.test_scores || r.test_scores.length === 0)) continue;

        const html = `
          <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: #2563eb; color: white; padding: 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 20px;">Weekly Progress Digest</h1>
              <p style="margin: 4px 0 0; opacity: 0.9;">${r.student_name} &bull; ${new Date().toLocaleDateString('en-IN', { month: 'long', day: 'numeric' })}</p>
            </div>
            <div style="padding: 24px;">
              <p>Hello ${r.parent_name || 'Parent'},</p>
              <p>Here is a summary of ${r.student_name}'s activity in tuition classes this week:</p>
              
              <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 16px; margin: 24px 0;">
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Attendance</div>
                  <div style="font-size: 24px; font-weight: bold; color: #0f172a;">${r.classes_attended}/${r.classes_total}</div>
                </div>
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Homework</div>
                  <div style="font-size: 24px; font-weight: bold; color: #0f172a;">${r.hw_completed}/${r.hw_total}</div>
                </div>
              </div>

              ${r.test_scores && r.test_scores.length > 0 ? `
                <h3 style="font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Recent Test Results</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  ${r.test_scores.map(t => `
                    <tr>
                      <td style="padding: 8px 0; color: #475569;">${t.subject}</td>
                      <td style="padding: 8px 0; text-align: right; font-weight: 600;">${t.marks}/${t.total}</td>
                    </tr>
                  `).join("")}
                </table>
              ` : ''}

              <p style="margin-top: 32px; font-size: 14px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 24px;">
                Generated by EduPulse AI for ${r.teacher_name}'s Classes.<br/>
                Login to the <a href="https://tuitiontrack-app.vercel.app" style="color: #2563eb;">Parent Portal</a> for full history.
              </p>
            </div>
          </div>
        `;

        parentPromises.push(fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "EduPulse AI Digests <reports@edupulse.ai>",
            to: [r.parent_email],
            subject: `Weekly Update: ${r.student_name}'s Performance`,
            html,
          }),
        }));
      }
    }

    await Promise.all([...tutorPromises, ...parentPromises]);

    return NextResponse.json({ 
      success: true, 
      tutor_alerts: tutorPromises.length, 
      parent_digests: parentPromises.length 
    });
  } catch (err) {
    console.error("Unhandled error in weekly-sync cron:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

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

export async function GET(request: Request) {
  try {
    // 1. Verify this request is from Vercel Cron
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && request.headers.get("x-vercel-cron") !== "1") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service role to bypass RLS for cron operations if possible
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Note: this is actually the PAT in our current setup
    
    // 2. Query all high risk students across all teachers via Management API (since we have PAT)
    const projectRef = supabaseUrl.replace("https://", "").split(".")[0];
    const query = `
      SELECT 
        pr.student_id,
        pr.risk_level,
        pr.risk_score,
        pr.attendance_pct,
        pr.homework_pct,
        s.name as student_name,
        s.class as student_class,
        u.id as teacher_id,
        u.email as teacher_email,
        u.name as teacher_name
      FROM public.performance_records pr
      JOIN public.students s ON pr.student_id = s.id
      JOIN public.users u ON s.teacher_id = u.id
      WHERE pr.risk_level = 'high'
      AND pr.created_at >= (now() - interval '7 days');
    `;

    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Management API query failed:", errorText);
      return NextResponse.json({ error: "Failed to query high risk records" }, { status: 500 });
    }

    const highRiskRecords = (await response.json()) as HighRiskRecord[];

    if (!highRiskRecords || highRiskRecords.length === 0) {
      return NextResponse.json({ message: "No high risk students found." });
    }

    // 3. Group by teacher
    const teacherMap = new Map<string, HighRiskRecord[]>();
    highRiskRecords.forEach((record) => {
      const teacherId = record.teacher_id;
      if (!teacherMap.has(teacherId)) {
        teacherMap.set(teacherId, []);
      }
      teacherMap.get(teacherId)!.push(record);
    });

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
       return NextResponse.json({ error: "Resend API key not configured" }, { status: 500 });
    }

    // 4. Send emails
    const sendPromises = Array.from(teacherMap.entries()).map(async ([, students]) => {
      const teacherEmail = students[0].teacher_email;
      const teacherName = students[0].teacher_name || "Tutor";
      
      const studentListHtml = students.map(s => `
        <li>
          <strong>${s.student_name}</strong> (Class ${s.student_class})<br/>
          Risk Score: ${s.risk_score}/100<br/>
          Attendance: ${s.attendance_pct}% | Homework: ${s.homework_pct}%
        </li>
      `).join("");

      const html = `
        <h2>EduPulse AI: High-Risk Student Alert</h2>
        <p>Hello ${teacherName},</p>
        <p>The following students have been identified as <strong>HIGH RISK</strong> based on their recent performance data:</p>
        <ul>
          ${studentListHtml}
        </ul>
        <p>We recommend reviewing their recent test scores and attendance records in your dashboard.</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://tuitiontrack-app.vercel.app'}/app/reports">View Reports Dashboard</a></p>
      `;

      return fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "EduPulse AI Alerts <alerts@edupulse.ai>",
          to: [teacherEmail],
          subject: `⚠️ Action Required: ${students.length} High-Risk Students Detected`,
          html,
        }),
      });
    });

    await Promise.all(sendPromises);

    return NextResponse.json({ message: `Alerts sent to ${teacherMap.size} teachers.` });
  } catch (err) {
    console.error("Unhandled error in monday-alerts cron:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

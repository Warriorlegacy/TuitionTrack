import { subDays } from "date-fns";
import type {
  AnnouncementRow,
  AttendanceRow,
  FeeRow,
  HomeworkRow,
  StudentRow,
  TestRow,
} from "@/lib/db/types";
import type { AuthContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DashboardStat = {
  label: string;
  value: string;
  helper: string;
};

export type ChartDatum = {
  name: string;
  value: number;
};

export type RecentActivityItem = {
  id: string;
  type: "homework" | "test" | "announcement" | "fee";
  title: string;
  description: string;
  created_at: string;
};

export type HomeworkItem = HomeworkRow & {
  student_name: string;
  student_class: string;
};

export type FeeItem = FeeRow & {
  student_name: string;
  student_class: string;
};

export type TestItem = TestRow & {
  student_name: string;
  student_class: string;
  percentage: number;
};

export type ReportStudentSummary = {
  student_id: string;
  student_name: string;
  class_name: string;
  attendance_percent: number;
  average_marks: number;
  pending_homework: number;
  pending_fees: number;
};

type JoinedStudent = {
  student?: {
    name?: string | null;
    class?: string | null;
  } | null;
};

type HomeworkQueryRow = HomeworkRow & JoinedStudent;
type FeeQueryRow = FeeRow & JoinedStudent;
type TestQueryRow = TestRow & JoinedStudent;

function getStudentIds(context: AuthContext) {
  return context.accessibleStudents.map((student) => student.id);
}

function buildMarksChart(tests: TestItem[]) {
  const bySubject = new Map<string, { total: number; count: number }>();

  tests.forEach((test) => {
    const existing = bySubject.get(test.subject) ?? { total: 0, count: 0 };
    existing.total += test.percentage;
    existing.count += 1;
    bySubject.set(test.subject, existing);
  });

  return Array.from(bySubject.entries()).map(([name, value]) => ({
    name,
    value: Number((value.total / value.count).toFixed(1)),
  }));
}

function buildReportSummaries(
  students: StudentRow[],
  homework: HomeworkItem[],
  attendance: AttendanceRow[],
  tests: TestItem[],
  fees: FeeItem[],
) {
  return students.map((student) => {
    const studentHomework = homework.filter((entry) => entry.student_id === student.id);
    const studentAttendance = attendance.filter((entry) => entry.student_id === student.id);
    const studentTests = tests.filter((entry) => entry.student_id === student.id);
    const studentFees = fees.filter((entry) => entry.student_id === student.id);

    const presentCount = studentAttendance.filter((entry) => entry.present).length;
    const attendancePercent = studentAttendance.length
      ? Math.round((presentCount / studentAttendance.length) * 100)
      : 0;
    const averageMarks = studentTests.length
      ? Number(
          (
            studentTests.reduce((total, current) => total + current.percentage, 0) /
            studentTests.length
          ).toFixed(1),
        )
      : 0;

    return {
      student_id: student.id,
      student_name: student.name,
      class_name: student.class,
      attendance_percent: attendancePercent,
      average_marks: averageMarks,
      pending_homework: studentHomework.filter((entry) => entry.status === "pending").length,
      pending_fees: studentFees.filter((entry) => entry.status !== "paid").length,
    };
  });
}

async function fetchHomework(context: AuthContext) {
  const supabase = createSupabaseServerClient();
  const studentIds = getStudentIds(context);
  let query = supabase
    .from("homework")
    .select(
      "id,title,description,due_date,student_id,teacher_id,status,created_at,updated_at,student:students(name,class)",
    )
    .order("due_date", { ascending: true });

  if (context.role === "teacher" && context.profile) {
    query = query.eq("teacher_id", context.profile.id);
  } else if (studentIds.length > 0) {
    query = query.in("student_id", studentIds);
  } else {
    return [] as HomeworkItem[];
  }

  const { data } = await query;

  return ((data as HomeworkQueryRow[] | null) ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    due_date: row.due_date,
    student_id: row.student_id,
    teacher_id: row.teacher_id,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    student_name: row.student?.name ?? "Unknown student",
    student_class: row.student?.class ?? "N/A",
  })) as HomeworkItem[];
}

async function fetchFees(context: AuthContext) {
  const supabase = createSupabaseServerClient();
  const studentIds = getStudentIds(context);
  let query = supabase
    .from("fees")
    .select(
      "id,student_id,amount,status,due_date,teacher_id,created_at,updated_at,student:students(name,class)",
    )
    .order("due_date", { ascending: true });

  if (context.role === "teacher" && context.profile) {
    query = query.eq("teacher_id", context.profile.id);
  } else if (studentIds.length > 0) {
    query = query.in("student_id", studentIds);
  } else {
    return [] as FeeItem[];
  }

  const { data } = await query;

  return ((data as FeeQueryRow[] | null) ?? []).map((row) => ({
    id: row.id,
    student_id: row.student_id,
    amount: row.amount,
    status: row.status,
    due_date: row.due_date,
    teacher_id: row.teacher_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    student_name: row.student?.name ?? "Unknown student",
    student_class: row.student?.class ?? "N/A",
  })) as FeeItem[];
}

async function fetchTests(context: AuthContext) {
  const supabase = createSupabaseServerClient();
  const studentIds = getStudentIds(context);
  let query = supabase
    .from("tests")
    .select(
      "id,student_id,subject,marks,total,date,teacher_id,created_at,student:students(name,class)",
    )
    .order("date", { ascending: false });

  if (context.role === "teacher" && context.profile) {
    query = query.eq("teacher_id", context.profile.id);
  } else if (studentIds.length > 0) {
    query = query.in("student_id", studentIds);
  } else {
    return [] as TestItem[];
  }

  const { data } = await query;

  return ((data as TestQueryRow[] | null) ?? []).map((row) => ({
    id: row.id,
    student_id: row.student_id,
    subject: row.subject,
    marks: row.marks,
    total: row.total,
    date: row.date,
    teacher_id: row.teacher_id,
    created_at: row.created_at,
    student_name: row.student?.name ?? "Unknown student",
    student_class: row.student?.class ?? "N/A",
    percentage: row.total ? Number(((row.marks / row.total) * 100).toFixed(1)) : 0,
  })) as TestItem[];
}

async function fetchAttendance(context: AuthContext) {
  const supabase = createSupabaseServerClient();
  const studentIds = getStudentIds(context);
  const windowStart = subDays(new Date(), 60).toISOString().slice(0, 10);
  let query = supabase
    .from("attendance")
    .select("*")
    .gte("date", windowStart)
    .order("date", { ascending: false });

  if (context.role === "teacher" && context.profile) {
    query = query.eq("teacher_id", context.profile.id);
  } else if (studentIds.length > 0) {
    query = query.in("student_id", studentIds);
  } else {
    return [] as AttendanceRow[];
  }

  const { data } = await query;
  return ((data as AttendanceRow[] | null) ?? []) as AttendanceRow[];
}

async function fetchAnnouncements(context: AuthContext) {
  const supabase = createSupabaseServerClient();
  if (context.teacherIds.length === 0) {
    return [] as AnnouncementRow[];
  }

  let query = supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  if (context.role === "teacher" && context.profile) {
    query = query.eq("teacher_id", context.profile.id);
  } else {
    query = query.in("teacher_id", context.teacherIds);
  }

  const { data } = await query;
  return ((data as AnnouncementRow[] | null) ?? []) as AnnouncementRow[];
}

export async function getDashboardPageData(context: AuthContext) {
  const [homework, fees, attendance, tests, announcements, atRiskStudents] = await Promise.all([
    fetchHomework(context),
    fetchFees(context),
    fetchAttendance(context),
    fetchTests(context),
    fetchAnnouncements(context),
    getAtRiskStudents(context),
  ]);

  const pendingHomework = homework.filter((entry) => entry.status === "pending").length;
  const attendancePercent = attendance.length
    ? Math.round((attendance.filter((entry) => entry.present).length / attendance.length) * 100)
    : 0;
  const averageMarks = tests.length
    ? Number(
        (tests.reduce((total, current) => total + current.percentage, 0) / tests.length).toFixed(1),
      )
    : 0;

  const highRiskCount = atRiskStudents.filter((entry) => entry.risk_level === "high").length;

  const stats: DashboardStat[] =
    context.role === "teacher"
      ? [
          {
            label: "Total students",
            value: String(context.accessibleStudents.length),
            helper: "Active students linked to your workspace",
          },
          {
            label: "Pending homework",
            value: String(pendingHomework),
            helper: "Assignments still waiting for completion",
          },
          {
            label: "At-Risk Students",
            value: String(highRiskCount),
            helper: "Students marked as high risk by EduPulse AI",
          },
          {
            label: "Attendance",
            value: `${attendancePercent}%`,
            helper: "Based on the latest 60-day attendance window",
          },
        ]
      : [
          {
            label: context.role === "parent" ? "Linked students" : "Assigned homework",
            value:
              context.role === "parent"
                ? String(context.accessibleStudents.length)
                : String(pendingHomework),
            helper:
              context.role === "parent"
                ? "Student records mapped to your login email"
                : "Homework currently pending for your student login",
          },
          {
            label: "Pending homework",
            value: String(pendingHomework),
            helper: "Tasks due soon or still incomplete",
          },
          {
            label: "Average marks",
            value: `${averageMarks}%`,
            helper: "Average test performance across visible records",
          },
          {
            label: "Attendance",
            value: `${attendancePercent}%`,
            helper: "Attendance percentage across recent classes",
          },
        ];

  const recentActivity = [
    ...homework.slice(0, 4).map((entry) => ({
      id: entry.id,
      type: "homework" as const,
      title: entry.title,
      description: `${entry.student_name} · Due ${entry.due_date}`,
      created_at: entry.created_at,
    })),
    ...tests.slice(0, 3).map((entry) => ({
      id: entry.id,
      type: "test" as const,
      title: `${entry.subject} assessment updated`,
      description: `${entry.student_name} scored ${entry.marks}/${entry.total}`,
      created_at: entry.created_at,
    })),
    ...fees.slice(0, 3).map((entry) => ({
      id: entry.id,
      type: "fee" as const,
      title: `${entry.student_name} fee record`,
      description: `${entry.status.toUpperCase()} · Due ${entry.due_date}`,
      created_at: entry.created_at,
    })),
    ...announcements.slice(0, 3).map((entry) => ({
      id: entry.id,
      type: "announcement" as const,
      title: entry.title,
      description: entry.message,
      created_at: entry.created_at,
    })),
  ]
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 8);

  return {
    stats,
    recentActivity,
    marksChart: buildMarksChart(tests),
    feeChart: [
      { name: "Paid", value: fees.filter((entry) => entry.status === "paid").length },
      { name: "Unpaid", value: fees.filter((entry) => entry.status === "unpaid").length },
      { name: "Overdue", value: fees.filter((entry) => entry.status === "overdue").length },
    ],
  };
}

export async function getStudentsPageData(context: AuthContext) {
  const students = context.accessibleStudents;
  const emails = new Set<string>();
  students.forEach((s) => {
    if (s.parent_email) emails.add(s.parent_email.toLowerCase());
    if (s.student_email) emails.add(s.student_email.toLowerCase());
  });

  const supabase = createSupabaseServerClient();
  const { data: userData } = await supabase
    .from("users")
    .select("email, role")
    .in("email", Array.from(emails));

  const roleMap: Record<string, string> = {};
  userData?.forEach((u) => {
    roleMap[u.email.toLowerCase()] = u.role;
  });

  const atRiskStudents = await getAtRiskStudents(context);
  const riskMap: Record<string, 'low' | 'medium' | 'high' | null> = {};
  students.forEach((s) => {
    riskMap[s.id] = 'low';
  });
  atRiskStudents.forEach((r) => {
    riskMap[r.student_id] = r.risk_level;
  });

  return {
    students,
    roleMap,
    riskMap,
  };
}

export async function getHomeworkPageData(context: AuthContext) {
  return {
    students: context.accessibleStudents,
    homework: await fetchHomework(context),
  };
}

export async function getAttendancePageData(context: AuthContext) {
  return {
    students: context.accessibleStudents,
    attendance: await fetchAttendance(context),
  };
}

export async function getTestsPageData(context: AuthContext) {
  const tests = await fetchTests(context);
  return {
    students: context.accessibleStudents,
    tests,
    marksChart: buildMarksChart(tests),
  };
}

export async function getFeesPageData(context: AuthContext) {
  return {
    students: context.accessibleStudents,
    fees: await fetchFees(context),
  };
}

export async function getAnnouncementsPageData(context: AuthContext) {
  return {
    announcements: await fetchAnnouncements(context),
  };
}



export async function getSettingsPageData(context: AuthContext) {
  return {
    profile: context.profile,
    studentsCount: context.accessibleStudents.length,
    mappedParentEmails: context.accessibleStudents.filter((entry) => entry.parent_email).length,
    mappedStudentEmails: context.accessibleStudents.filter((entry) => entry.student_email).length,
  };
}


// ── EduPulse AI — New Types ───────────────────────────────────────────────────

export type AtRiskStudent = {
  student_id: string;
  student_name: string;
  class_name: string;
  parent_email: string | null;
  attendance_pct: number | null;
  avg_score: number | null;
  homework_pct: number | null;
  risk_score: number | null;
  risk_level: 'low' | 'medium' | 'high' | null;
  latest_period: string | null;
};

export type PerformanceSummary = {
  student_id: string;
  student_name: string;
  class_name: string;
  period_label: string;
  attendance_pct: number | null;
  score_1: number | null;
  score_2: number | null;
  score_3: number | null;
  avg_score: number | null;
  homework_pct: number | null;
  risk_score: number | null;
  risk_level: 'low' | 'medium' | 'high' | null;
  tutor_notes: string | null;
  created_at: string;
};

export type AIReportSummary = {
  id: string;
  student_id: string;
  student_name: string;
  class_name: string;
  subject: string | null;
  status: string;
  sent_at: string | null;
  sent_to: string | null;
  created_at: string;
};

// ── EduPulse AI — At-Risk Detection ──────────────────────────────────────────

async function fetchPerformanceRecords(context: AuthContext) {
  const supabase = createSupabaseServerClient();
  const teacherId = context.profile?.id;
  if (!teacherId) return [];

  const { data } = await supabase
    .from('performance_records')
    .select(
      'id, student_id, period_label, attendance_pct, score_1, score_2, score_3, homework_pct, risk_score, risk_level, created_at, student:students(name,class)'
    )
    .order('created_at', { ascending: false });

  if (!data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    id: row.id,
    student_id: row.student_id,
    period_label: row.period_label,
    attendance_pct: row.attendance_pct,
    score_1: row.score_1,
    score_2: row.score_2,
    score_3: row.score_3,
    homework_pct: row.homework_pct,
    risk_score: row.risk_score,
    risk_level: row.risk_level,
    created_at: row.created_at,
    student_name: row.student?.name ?? 'Unknown',
    class_name: row.student?.class ?? 'N/A',
    avg_score: row.score_1 && row.score_2 && row.score_3
      ? Number(((row.score_1 + row.score_2 + row.score_3) / 3).toFixed(1))
      : (row.score_1 ?? null),
    tutor_notes: row.tutor_notes ?? null,
  })) as PerformanceSummary[];
}

async function fetchAIReports(context: AuthContext) {
  const supabase = createSupabaseServerClient();
  const teacherId = context.profile?.id;
  if (!teacherId) return [];

  const { data } = await supabase
    .from('reports')
    .select(
      'id, student_id, status, subject, sent_at, sent_to, created_at, student:students(name,class)'
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (!data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    id: row.id,
    student_id: row.student_id,
    student_name: row.student?.name ?? 'Unknown',
    class_name: row.student?.class ?? 'N/A',
    subject: row.subject,
    status: row.status,
    sent_at: row.sent_at,
    sent_to: row.sent_to,
    created_at: row.created_at,
  })) as AIReportSummary[];
}

export async function getAtRiskStudents(context: AuthContext): Promise<AtRiskStudent[]> {
  const records = await fetchPerformanceRecords(context);

  const latestByStudent = new Map<string, PerformanceSummary>();
  records.forEach((r) => {
    const existing = latestByStudent.get(r.student_id);
    if (!existing || new Date(r.created_at) > new Date(existing.created_at)) {
      latestByStudent.set(r.student_id, r);
    }
  });

  return Array.from(latestByStudent.values())
    .filter((r) => r.risk_level === 'high' || r.risk_level === 'medium')
    .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
    .map((r) => ({
      student_id: r.student_id,
      student_name: r.student_name,
      class_name: r.class_name,
      parent_email: null,
      attendance_pct: r.attendance_pct,
      avg_score: r.score_1 && r.score_2 && r.score_3
        ? Number(((r.score_1 + r.score_2 + r.score_3) / 3).toFixed(1))
        : (r.score_1 ?? null),
      homework_pct: r.homework_pct,
      risk_score: r.risk_score,
      risk_level: r.risk_level,
      latest_period: r.period_label,
    })) as AtRiskStudent[];
}

export async function getAllPerformanceHistory(
  context: AuthContext,
  studentId: string,
): Promise<PerformanceSummary[]> {
  const records = await fetchPerformanceRecords(context);
  return records.filter((r) => r.student_id === studentId).sort(
    (a, b) => new Date(a.period_label).getTime() - new Date(b.period_label).getTime(),
  );
}

export async function getAIReportsForStudent(
  context: AuthContext,
  studentId: string,
): Promise<AIReportSummary[]> {
  const supabase = createSupabaseServerClient();
  const teacherId = context.profile?.id;
  if (!teacherId) return [];

  const { data } = await supabase
    .from('reports')
    .select('id, student_id, status, subject, sent_at, sent_to, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    student_id: row.student_id,
    student_name: '',
    class_name: '',
    subject: row.subject,
    status: row.status,
    sent_at: row.sent_at,
    sent_to: row.sent_to,
    created_at: row.created_at,
  })) as AIReportSummary[];
}

export async function getReportsPageData(context: AuthContext) {
  const [homework, attendance, tests, fees, reports] = await Promise.all([
    fetchHomework(context),
    fetchAttendance(context),
    fetchTests(context),
    fetchFees(context),
    fetchAIReports(context),
  ]);

  return {
    summaries: buildReportSummaries(context.accessibleStudents, homework, attendance, tests, fees),
    marksChart: buildMarksChart(tests),
    feeChart: [
      { name: 'Paid', value: fees.filter((entry) => entry.status === 'paid').length },
      { name: 'Pending', value: fees.filter((entry) => entry.status !== 'paid').length },
    ],
    recentReports: reports.slice(0, 10),
    atRiskCount: (await getAtRiskStudents(context)).length,
  };
}

export async function getAnalyticsPageData(context: AuthContext) {
  const atRisk = await getAtRiskStudents(context);
  const records = await fetchPerformanceRecords(context);
  const reports = await fetchAIReports(context);

  const totalStudents = context.accessibleStudents.length;
  const highRisk = atRisk.filter((s) => s.risk_level === 'high').length;
  const mediumRisk = atRisk.filter((s) => s.risk_level === 'medium').length;
  const lowRisk = totalStudents - highRisk - mediumRisk;

  const studentRecords = new Map<string, PerformanceSummary[]>();
  records.forEach((r) => {
    const arr = studentRecords.get(r.student_id) ?? [];
    arr.push(r);
    studentRecords.set(r.student_id, arr);
  });

  let improvingCount = 0;
  let decliningCount = 0;
  studentRecords.forEach((arr) => {
    if (arr.length >= 2) {
      const sorted = [...arr].sort((a, b) =>
        new Date(a.period_label).getTime() - new Date(b.period_label).getTime(),
      );
      const firstAvg = sorted[0].score_1 ?? 0;
      const lastAvg = sorted[sorted.length - 1].score_1 ?? 0;
      if (lastAvg > firstAvg) improvingCount++;
      else if (lastAvg < firstAvg) decliningCount++;
    }
  });

  return {
    totalStudents,
    highRisk,
    mediumRisk,
    lowRisk,
    improvingCount,
    decliningCount,
    atRiskStudents: atRisk,
    recentReportsCount: reports?.length ?? 0,
  };
}

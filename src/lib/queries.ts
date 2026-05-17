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
  const [homework, fees, attendance, tests, announcements] = await Promise.all([
    fetchHomework(context),
    fetchFees(context),
    fetchAttendance(context),
    fetchTests(context),
    fetchAnnouncements(context),
  ]);

  const pendingHomework = homework.filter((entry) => entry.status === "pending").length;
  const pendingFees = fees.filter((entry) => entry.status !== "paid").length;
  const attendancePercent = attendance.length
    ? Math.round((attendance.filter((entry) => entry.present).length / attendance.length) * 100)
    : 0;
  const averageMarks = tests.length
    ? Number(
        (tests.reduce((total, current) => total + current.percentage, 0) / tests.length).toFixed(1),
      )
    : 0;

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
            label: "Fees pending",
            value: String(pendingFees),
            helper: "Fee records still marked unpaid or overdue",
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

  return {
    students,
    roleMap,
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

export async function getReportsPageData(context: AuthContext) {
  const [homework, attendance, tests, fees] = await Promise.all([
    fetchHomework(context),
    fetchAttendance(context),
    fetchTests(context),
    fetchFees(context),
  ]);

  return {
    summaries: buildReportSummaries(context.accessibleStudents, homework, attendance, tests, fees),
    marksChart: buildMarksChart(tests),
    feeChart: [
      { name: "Paid", value: fees.filter((entry) => entry.status === "paid").length },
      { name: "Pending", value: fees.filter((entry) => entry.status !== "paid").length },
    ],
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

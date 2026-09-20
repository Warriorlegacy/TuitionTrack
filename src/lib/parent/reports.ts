import { getProgressOverview } from "@/lib/parent/progress";
import { getHomeworkCompletionRate, listHomeworkForStudent } from "@/lib/parent/homework";
import { listTestResultsForStudent, getSubjectPerformance } from "@/lib/parent/tests";
import { getAttendanceSummary, getAttendanceForMonth } from "@/lib/parent/attendance";
import { listAssignmentsForStudent } from "@/lib/parent/assignments";

export interface WeeklyReportData {
  studentName: string;
  className: string;
  generatedAt: string;
  dataCutoff: string;
  attendancePresentDays: number;
  attendanceTotalDays: number;
  attendancePercent: number | null;
  homeworkRate: number | null;
  homeworkCompleted: number;
  homeworkTotal: number;
  assignmentsSubmitted: number;
  assignmentsTotal: number;
  testsTaken: number;
  testAveragePercent: number | null;
  conceptMasteryPercent: number | null;
  improvedConcepts: string[];
  needsPractice: string[];
  teacherFeedback: string[];
  recommendedActions: string[];
}

export interface SubjectReportSummary {
  subject: string;
  chaptersTaught: number;
  chaptersTotal: number;
  coveragePercent: number | null;
  masteryPercent: number | null;
  testAverage: number | null;
  homeworkCompleted: number;
  homeworkTotal: number;
  status: "On Track" | "Needs Attention" | "Excelling";
}

export interface MonthlyReportData {
  studentName: string;
  className: string;
  monthName: string;
  year: number;
  generatedAt: string;
  dataCutoff: string;
  attendancePresent: number;
  attendanceAbsent: number;
  attendanceRate: number | null;
  curriculumCoveragePercent: number | null;
  conceptMasteryPercent: number | null;
  homeworkCompletionRate: number | null;
  testAveragePercent: number | null;
  subjects: SubjectReportSummary[];
  improvementTrends: string[];
  unresolvedWeakAreas: string[];
  teacherComments: string[];
  parentActions: string[];
}

export interface ReportCardGrade {
  subject: string;
  marksObtained: number | null;
  totalMarks: number | null;
  percentage: number | null;
  grade: string;
  remarks: string;
}

export interface FormalReportCardData {
  reportId: string;
  studentName: string;
  className: string;
  academicYear: string;
  term: string;
  generatedAt: string;
  dataCutoff: string;
  attendanceRecord: {
    present: number;
    totalMarked: number;
    percentage: number | null;
  };
  curriculumProgress: {
    chaptersCovered: number;
    totalPlanChapters: number | null;
    coveragePercent: number | null;
    masteryPercent: number | null;
  };
  subjectGrades: ReportCardGrade[];
  overallAveragePercent: number | null;
  overallGrade: string;
  areasOfStrength: string[];
  areasForDevelopment: string[];
  nextSteps: string[];
  teacherRemarks: string;
}

function computeGrade(pct: number | null): string {
  if (pct === null) return "—";
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 40) return "D";
  return "E";
}

export async function getWeeklyReport(
  studentId: string,
  studentName: string,
  studentClass: string,
): Promise<WeeklyReportData> {
  const [prog, tests, hwRate, assignments, attSummary] = await Promise.all([
    getProgressOverview(studentId, studentClass).catch(() => null),
    listTestResultsForStudent(studentId, 10).catch(() => []),
    getHomeworkCompletionRate(studentId, "week").catch(() => null),
    listAssignmentsForStudent(studentId, "all").catch(() => []),
    getAttendanceSummary(studentId).catch(() => null),
  ]);

  const now = new Date();
  const yesterday = new Date(Date.now() - 86400000);

  const testAvg =
    tests.length > 0
      ? Math.round(
          tests.reduce((acc, t) => acc + (t.percentage ?? 0), 0) / tests.length,
        )
      : null;

  const improvedConcepts: string[] = [];
  const needsPractice: string[] = [];
  const teacherFeedback: string[] = [];

  tests.forEach((t) => {
    if (t.teacherFeedback) {
      teacherFeedback.push(t.teacherFeedback);
    }
    if (t.percentage !== null && t.percentage >= 80) {
      improvedConcepts.push(`${t.subject ?? "Assessment"}: ${t.title}`);
    } else if (t.percentage !== null && t.percentage < 65) {
      needsPractice.push(`${t.subject ?? "Assessment"}: ${t.title}`);
    }
  });

  const recommendedActions: string[] = [];
  if (needsPractice.length > 0) {
    recommendedActions.push(`Schedule 15 minutes of revision on ${needsPractice[0]}.`);
  }
  if (hwRate && hwRate.rate !== null && hwRate.rate < 80) {
    recommendedActions.push("Review pending homework assignments together each evening.");
  }
  // No filler: "maintain your current schedule" would assert that a regular
  // study schedule exists. When nothing needs acting on, the list is empty.

  return {
    studentName,
    className: studentClass,
    generatedAt: now.toLocaleDateString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
    dataCutoff: yesterday.toLocaleDateString("en-IN", { dateStyle: "medium" }),
    attendancePresentDays: attSummary?.daysPresent ?? 0,
    attendanceTotalDays: attSummary?.daysMarked ?? 0,
    attendancePercent: attSummary?.percentPresent ?? null,
    homeworkRate: hwRate?.rate ?? null,
    homeworkCompleted: hwRate?.completed ?? 0,
    homeworkTotal: hwRate?.total ?? 0,
    assignmentsSubmitted: assignments.filter((a) => a.displayStatus === "submitted" || a.displayStatus === "graded").length,
    assignmentsTotal: assignments.length,
    testsTaken: tests.length,
    testAveragePercent: testAvg,
    conceptMasteryPercent: prog?.conceptMastery.averageMastery ? Math.round(prog.conceptMastery.averageMastery * 100) : null,
    improvedConcepts: improvedConcepts.slice(0, 3),
    needsPractice: needsPractice.slice(0, 3),
    teacherFeedback: teacherFeedback.slice(0, 2),
    recommendedActions,
  };
}

export async function getMonthlyReport(
  studentId: string,
  studentName: string,
  studentClass: string,
  year?: number,
  month?: number,
): Promise<MonthlyReportData> {
  const targetYear = year ?? new Date().getFullYear();
  const targetMonth = month ?? new Date().getMonth() + 1;

  const [prog, tests, hwRate, allHw, attMonth, subjectPerf] = await Promise.all([
    getProgressOverview(studentId, studentClass).catch(() => null),
    listTestResultsForStudent(studentId, 30).catch(() => []),
    getHomeworkCompletionRate(studentId, "month").catch(() => null),
    listHomeworkForStudent(studentId, "all").catch(() => []),
    getAttendanceForMonth(studentId, targetYear, targetMonth).catch(() => null),
    getSubjectPerformance(studentId).catch(() => []),
  ]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const monthName = monthNames[targetMonth - 1] ?? "Current Month";

  const subjects: SubjectReportSummary[] = subjectPerf.map((sp) => {
    const hwForSubj = allHw.filter((h) => h.subject === sp.subject);
    const completedHw = hwForSubj.filter((h) => h.status === "completed").length;
    const avg = sp.averagePercentage;
    const status: "On Track" | "Needs Attention" | "Excelling" =
      avg >= 80 ? "Excelling" : avg < 60 ? "Needs Attention" : "On Track";

    return {
      subject: sp.subject,
      chaptersTaught: 1,
      chaptersTotal: 1,
      coveragePercent: null,
      masteryPercent: null,
      testAverage: avg,
      homeworkCompleted: completedHw,
      homeworkTotal: hwForSubj.length,
      status,
    };
  });

  const improvementTrends: string[] = [];
  const unresolvedWeakAreas: string[] = [];
  const teacherComments: string[] = [];

  tests.forEach((t) => {
    if (t.teacherFeedback) teacherComments.push(`"${t.teacherFeedback}" (${t.subject ?? "Test"})`);
    if (t.percentage !== null && t.percentage < 65) {
      unresolvedWeakAreas.push(`${t.subject ?? "Assessment"}: ${t.title} (${Math.round(t.percentage)}%)`);
    } else if (t.percentage !== null && t.percentage >= 80) {
      improvementTrends.push(`Strong performance in ${t.subject ?? "Assessment"} (${Math.round(t.percentage)}%)`);
    }
  });

  const now = new Date();
  const yesterday = new Date(Date.now() - 86400000);

  return {
    studentName,
    className: studentClass,
    monthName,
    year: targetYear,
    generatedAt: now.toLocaleDateString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
    dataCutoff: yesterday.toLocaleDateString("en-IN", { dateStyle: "medium" }),
    attendancePresent: attMonth?.daysPresent ?? 0,
    attendanceAbsent: attMonth?.daysAbsent ?? 0,
    attendanceRate: attMonth?.percentPresent ?? null,
    curriculumCoveragePercent: prog?.curriculumCoverage.percentOfPlan ?? null,
    conceptMasteryPercent: prog?.conceptMastery.averageMastery ? Math.round(prog.conceptMastery.averageMastery * 100) : null,
    homeworkCompletionRate: hwRate?.rate ?? null,
    testAveragePercent:
      tests.length > 0
        ? Math.round(tests.reduce((acc, t) => acc + (t.percentage ?? 0), 0) / tests.length)
        : null,
    subjects,
    improvementTrends: improvementTrends.slice(0, 4),
    unresolvedWeakAreas: unresolvedWeakAreas.slice(0, 3),
    teacherComments: teacherComments.slice(0, 3),
    // Derived from this student's own records. Previously these two strings
    // were hardcoded and identical for every child in the school.
    parentActions: [
      ...(unresolvedWeakAreas.length > 0
        ? [`Review the feedback on ${unresolvedWeakAreas[0]} together.`]
        : []),
      ...(improvementTrends.length > 0
        ? [`Build on recent improvement in ${improvementTrends[0]}.`]
        : []),
      ...(hwRate && hwRate.rate !== null && hwRate.rate < 80
        ? [`Check homework is submitted before due dates — ${Math.round(hwRate.rate)}% completed recently.`]
        : []),
    ],
  };
}

export async function getFormalReportCard(
  studentId: string,
  studentName: string,
  studentClass: string,
  term = "Term 1 (2026–27)",
): Promise<FormalReportCardData> {
  const [prog, attSummary, subjectPerf] = await Promise.all([
    getProgressOverview(studentId, studentClass).catch(() => null),
    getAttendanceSummary(studentId).catch(() => null),
    getSubjectPerformance(studentId).catch(() => []),
  ]);

  const subjectGrades: ReportCardGrade[] = subjectPerf.map((sp) => {
    const pct = sp.averagePercentage;
    const grade = computeGrade(pct);
    let remarks = "Satisfactory progress demonstrated.";
    if (pct >= 85) remarks = "Exemplary understanding and consistent test performance.";
    else if (pct >= 70) remarks = "Good grasp of core principles; continued practice advised.";
    else if (pct < 60) remarks = "Needs focused revision on problem sets and conceptual definitions.";

    return {
      subject: sp.subject,
      marksObtained: null,
      totalMarks: null,
      percentage: pct,
      grade,
      remarks,
    };
  });

  const overallAvg =
    subjectGrades.length > 0
      ? Math.round(
          subjectGrades.reduce((s, g) => s + (g.percentage ?? 0), 0) / subjectGrades.length,
        )
      : null;

  const strengths: string[] = [];
  const devAreas: string[] = [];

  subjectGrades.forEach((g) => {
    if (g.percentage !== null && g.percentage >= 75) {
      strengths.push(`${g.subject}: Consistent grasp of concepts and strong assessment results (${g.grade})`);
    } else if (g.percentage !== null && g.percentage < 65) {
      devAreas.push(`${g.subject}: Focus required to strengthen weaker chapter scores (${g.grade})`);
    }
  });

  // No filler. A student whose subjects are all in the 65–75% band has no
  // recorded strength and no recorded development area, and padding the lists
  // with generic praise would invent a claim about attendance and engagement
  // that nothing in the database supports (§111). Empty is the honest answer.

  const now = new Date();
  const yesterday = new Date(Date.now() - 86400000);

  return {
    reportId: `TT-RC-${now.getFullYear()}-${studentId.slice(0, 6).toUpperCase()}`,
    studentName,
    className: studentClass,
    academicYear: "2026–2027",
    term,
    generatedAt: now.toLocaleDateString("en-IN", { dateStyle: "long", timeStyle: "short" }),
    dataCutoff: yesterday.toLocaleDateString("en-IN", { dateStyle: "long" }),
    attendanceRecord: {
      present: attSummary?.daysPresent ?? 0,
      totalMarked: attSummary?.daysMarked ?? 0,
      percentage: attSummary?.percentPresent ?? null,
    },
    curriculumProgress: {
      chaptersCovered: prog?.curriculumCoverage.chaptersCovered ?? 0,
      totalPlanChapters: prog?.curriculumCoverage.planChapters ?? null,
      coveragePercent: prog?.curriculumCoverage.percentOfPlan ?? null,
      masteryPercent: prog?.conceptMastery.averageMastery ? Math.round(prog.conceptMastery.averageMastery * 100) : null,
    },
    subjectGrades,
    overallAveragePercent: overallAvg,
    overallGrade: computeGrade(overallAvg),
    areasOfStrength: strengths,
    areasForDevelopment: devAreas,
    nextSteps: [
      "Maintain active practice on homework problem sets.",
      "Review weekly assessment feedback with tuition mentor.",
      "Focus on step-by-step problem-solving methods.",
    ],
    teacherRemarks:
      overallAvg !== null && overallAvg >= 75
        ? `${studentName} demonstrates conscientious application and a strong work ethic. Keep up the high standard of academic effort.`
        : `${studentName} is making progress. Focused revision and timely homework completion will yield significant gains in upcoming evaluations.`,
  };
}

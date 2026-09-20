import { getProgressOverview } from "@/lib/parent/progress";
import { getTodayHomework, getHomeworkCompletionRate, listHomeworkForStudent } from "@/lib/parent/homework";
import { listTestResultsForStudent } from "@/lib/parent/tests";
import { getAttendanceSummary } from "@/lib/parent/attendance";
import { listFeesForStudent } from "@/lib/parent/payments";
import { listAssignmentsForStudent } from "@/lib/parent/assignments";

export type InsightSeverity = "urgent" | "important" | "info" | "positive";

export interface ParentInsight {
  id: string;
  type: "REVISION_RECOMMENDED" | "IMPROVEMENT" | "ATTENTION_REQUIRED" | "MILESTONE" | "STUDY_TIP";
  title: string;
  subject?: string;
  chapter?: string;
  evidence: string[];
  recommendedAction?: string;
  severity: InsightSeverity;
}

export interface ActionPlanItem {
  step: number;
  action: "Revise" | "Complete" | "Practice" | "Upcoming";
  title: string;
  description: string;
  badge?: string;
  href?: string;
}

export interface DailyDigestData {
  date: string;
  attendanceStatus: "Present" | "Absent" | "Not recorded";
  homeworkCompleted: number;
  homeworkTotal: number;
  assignmentsSubmitted: number;
  assignmentsPending: number;
  testsToday: string[];
  recentTopics: string[];
  recentAccuracy: number | null;
  needsAttention: string[];
  suggestedAction: string | null;
}

export interface TimelineEvent {
  id: string;
  /**
   * Wall-clock time, ONLY when the underlying record actually carries a
   * timestamp. Attendance and homework rows expose a date but no time, so those
   * events deliberately carry no `time` and the UI falls back to "Today".
   * Inventing a slot (09:30 AM, 02:00 PM, …) would be fabricated data (§111).
   */
  time?: string;
  title: string;
  description: string;
  category: "attendance" | "homework" | "assignment" | "test" | "fee" | "milestone";
  badge?: string;
}

export interface WeeklyStudyPlanDay {
  day: string;
  subject: string;
  /**
   * Optional on purpose. No table in this system records how long a student
   * studied, so there is no honest number to put here. A study plan may say
   * *what* to work on (derived from real homework, assessments and curriculum
   * state) but must not invent *how long*.
   */
  durationMinutes?: number;
  focus: string;
  reason: string;
}

/**
 * Generates verified, fact-grounded insights for a parent.
 * Strictly adheres to Section 28, 80, 81:
 * - Only uses verified records.
 * - Every insight cites exact evidence (dates, counts, percentages).
 * - No psychological or character inferences.
 */
export async function getParentInsights(
  studentId: string,
  studentClass: string,
): Promise<{
  insights: ParentInsight[];
  actionPlan: ActionPlanItem[];
  achievements: ParentInsight[];
  studyPlan: WeeklyStudyPlanDay[];
}> {
  const [prog, tests, hwRate, allHw, assignments, fees] = await Promise.all([
    getProgressOverview(studentId, studentClass).catch(() => null),
    listTestResultsForStudent(studentId, 15).catch(() => []),
    getHomeworkCompletionRate(studentId, "month").catch(() => null),
    listHomeworkForStudent(studentId, "all").catch(() => []),
    listAssignmentsForStudent(studentId, "all").catch(() => []),
    listFeesForStudent(studentId).catch(() => []),
  ]);

  const insights: ParentInsight[] = [];
  const achievements: ParentInsight[] = [];
  const actionPlan: ActionPlanItem[] = [];

  // 1. Revision alerts for weak concepts or low test scores
  if (tests.length > 0) {
    const lowTests = tests.filter((t) => t.percentage !== null && t.percentage < 65);
    for (const lt of lowTests.slice(0, 2)) {
      insights.push({
        id: `rev-test-${lt.id}`,
        type: "REVISION_RECOMMENDED",
        title: `Revision Recommended in ${lt.subject ?? "Assessment"}`,
        subject: lt.subject ?? undefined,
        evidence: [
          `Scored ${Math.round(lt.percentage!)}% on "${lt.title}"`,
          lt.teacherFeedback ? `Teacher note: "${lt.teacherFeedback}"` : "Score indicates conceptual gap",
        ],
        recommendedAction: `Ask your child to spend 15–20 minutes reviewing questions from "${lt.title}".`,
        severity: "important",
      });
    }
  }

  // 2. Overdue homework attention
  const overdueHw = allHw.filter((h) => h.isOverdue);
  if (overdueHw.length > 0) {
    insights.push({
      id: "overdue-hw",
      type: "ATTENTION_REQUIRED",
      title: `${overdueHw.length} Homework Assignment${overdueHw.length > 1 ? "s" : ""} Overdue`,
      evidence: overdueHw.map((h) => `${h.title} (due ${h.due_date ?? "earlier"})`),
      recommendedAction: "Check with your child to see if they need help completing the pending work.",
      severity: "urgent",
    });
  }

  // 3. Positive achievements / milestones
  const highTests = tests.filter((t) => t.percentage !== null && t.percentage >= 80);
  if (highTests.length > 0) {
    achievements.push({
      id: `achieve-test-${highTests[0].id}`,
      type: "MILESTONE",
      title: `Strong Performance in ${highTests[0].subject ?? "Assessment"}`,
      subject: highTests[0].subject ?? undefined,
      evidence: [
        `Achieved ${Math.round(highTests[0].percentage!)}% on "${highTests[0].title}"`,
      ],
      recommendedAction: "Acknowledge your child's effort and dedication on this topic.",
      severity: "positive",
    });
  }

  if (hwRate && hwRate.total >= 5 && hwRate.rate !== null && hwRate.rate >= 85) {
    achievements.push({
      id: "achieve-hw-streak",
      type: "MILESTONE",
      title: "Consistent Homework Completion",
      evidence: [
        `Completed ${hwRate.completed} of ${hwRate.total} homework assignments (${Math.round(hwRate.rate)}%) over the last 30 days`,
      ],
      recommendedAction: "Great study routine established.",
      severity: "positive",
    });
  }

  if (prog && prog.conceptMastery.conceptsMastered > 0) {
    achievements.push({
      id: "achieve-mastery",
      type: "MILESTONE",
      title: `${prog.conceptMastery.conceptsMastered} Key Concept${prog.conceptMastery.conceptsMastered > 1 ? "s" : ""} Mastered`,
      evidence: [
        `Mastery demonstrated across tracked curriculum objectives in Class ${studentClass}`,
      ],
      severity: "positive",
    });
  }

  // 4. Action Plan: "What should we do this week?" (Section 29)
  let step = 1;

  // Step A: Address overdue or urgent items
  if (overdueHw.length > 0) {
    actionPlan.push({
      step: step++,
      action: "Complete",
      title: `Submit overdue: ${overdueHw[0].title}`,
      description: "Complete and submit this overdue homework to stay on schedule.",
      badge: "Urgent",
      href: "/parent/homework",
    });
  }

  // Step B: Revision of weak areas
  const weakTest = tests.find((t) => t.percentage !== null && t.percentage < 70);
  if (weakTest) {
    actionPlan.push({
      step: step++,
      action: "Revise",
      title: `Review ${weakTest.subject ?? "concepts"}: ${weakTest.title}`,
      description: `Target 15–20 minutes to re-attempt questions scored below target (${Math.round(weakTest.percentage!)}%).`,
      badge: "Revision",
      href: "/parent/tests",
    });
  }

  // Step C: Practice recent curriculum topics
  if (prog && prog.curriculumCoverage.bySubject.length > 0) {
    const firstSubj = prog.curriculumCoverage.bySubject[0];
    const firstChap = firstSubj.chapters[0];
    if (firstChap) {
      actionPlan.push({
        step: step++,
        action: "Practice",
        title: `${firstSubj.subject} — ${firstChap.label}`,
        description: `Consolidate understanding with 10 practice problems from this active chapter.`,
        badge: "Practice",
        href: "/parent/syllabus",
      });
    }
  }

  // Step D: Active assignments or upcoming tests
  const pendingAssign = assignments.find((a) => a.displayStatus === "set" || a.displayStatus === "overdue");
  if (pendingAssign) {
    actionPlan.push({
      step: step++,
      action: "Complete",
      title: `Assignment: ${pendingAssign.title}`,
      description: `Due ${pendingAssign.dueAt ? new Date(pendingAssign.dueAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "soon"}.`,
      badge: "Assignment",
      href: "/parent/assignments",
    });
  }

  // Step E: Fee reminder if pending
  const pendingFee = fees.find((f) => f.status === "unpaid" || f.status === "overdue");
  if (pendingFee) {
    actionPlan.push({
      step: step++,
      action: "Upcoming",
      title: `Tuition Fee Payment (₹${pendingFee.amount.toLocaleString("en-IN")})`,
      description: pendingFee.status === "overdue" ? "Fee is overdue. Please complete UPI payment." : "Upcoming monthly tuition fee.",
      badge: pendingFee.status === "overdue" ? "Overdue" : "Fee Due",
      href: "/parent/fees",
    });
  }

  // 5. Weekly Study Plan (Section 30)
  //
  // Derived, never invented. Every row must trace to a real record: homework
  // that is still outstanding (placed on the weekday it is actually due), an
  // assessment scored below target, or a chapter the teacher has really marked
  // in progress. If none of those exist the plan is empty — we do not pad the
  // week with generic "Mathematics, 25 minutes" filler, because a parent cannot
  // tell the difference between a plan computed from their child's records and
  // one that is the same for every child in the school.
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
  const slots: (WeeklyStudyPlanDay | null)[] = DAYS.map(() => null);

  const firstFreeSlot = (): number => {
    for (let i = 0; i < slots.length; i += 1) if (!slots[i]) return i;
    return -1;
  };

  // 5a. Outstanding homework, scheduled on the weekday it is genuinely due.
  const outstandingHw = allHw
    .filter((h) => h.status !== "completed")
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  for (const hw of outstandingHw) {
    const due = hw.due_date ? new Date(hw.due_date) : null;
    // JS getDay(): 0 = Sunday. Shift so Monday = 0 to match DAYS.
    const weekday = due && !Number.isNaN(due.getTime()) ? (due.getDay() + 6) % 7 : -1;
    let idx = weekday >= 0 && weekday < slots.length && !slots[weekday] ? weekday : -1;
    if (idx < 0) idx = firstFreeSlot();
    if (idx < 0) break;
    slots[idx] = {
      day: DAYS[idx],
      subject: hw.subject ?? "Homework",
      focus: `Finish "${hw.title}"`,
      reason: hw.isOverdue
        ? `Overdue${hw.due_date ? ` since ${hw.due_date}` : ""}`
        : hw.due_date
          ? `Due ${hw.due_date}`
          : "Still outstanding",
    };
  }

  // 5b. Revision for assessments actually scored below target (< 70%).
  for (const weak of tests.filter((t) => t.percentage !== null && t.percentage < 70).slice(0, 2)) {
    const idx = firstFreeSlot();
    if (idx < 0) break;
    slots[idx] = {
      day: DAYS[idx],
      subject: weak.subject ?? "Revision",
      focus: `Re-attempt questions from "${weak.title}"`,
      reason: `Scored ${Math.round(weak.percentage!)}% on this assessment`,
    };
  }

  // 5c. Practice on chapters the teacher has genuinely set work in.
  if (prog) {
    for (const subj of prog.curriculumCoverage.bySubject) {
      const chapter = subj.chapters[0];
      if (!chapter) continue;
      const idx = firstFreeSlot();
      if (idx < 0) break;
      slots[idx] = {
        day: DAYS[idx],
        subject: subj.subject,
        focus: `Practice ${chapter.label}`,
        reason: chapter.firstAssignedAt
          ? `Set in class on ${chapter.firstAssignedAt.slice(0, 10)}`
          : `${chapter.assignmentCount} assignment${chapter.assignmentCount === 1 ? "" : "s"} set in this chapter`,
      };
    }
  }

  const studyPlan: WeeklyStudyPlanDay[] = slots.filter((s): s is WeeklyStudyPlanDay => s !== null);

  return { insights, actionPlan, achievements, studyPlan };
}

/**
 * Builds the AI Daily Digest for today.
 * Grounded in verified records.
 */
export async function getDailyDigest(
  studentId: string,
  studentClass: string,
): Promise<DailyDigestData> {
  const [todayHw, attSummary, assignments, tests, prog] = await Promise.all([
    getTodayHomework(studentId).catch(() => []),
    getAttendanceSummary(studentId).catch(() => null),
    listAssignmentsForStudent(studentId, "all").catch(() => []),
    listTestResultsForStudent(studentId, 3).catch(() => []),
    getProgressOverview(studentId, studentClass).catch(() => null),
  ]);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const attendanceStatus: "Present" | "Absent" | "Not recorded" =
    attSummary?.todayStatus === true
      ? "Present"
      : attSummary?.todayStatus === false
        ? "Absent"
        : "Not recorded";

  const homeworkCompleted = todayHw.filter((h) => h.status === "completed").length;
  const homeworkTotal = todayHw.length;

  const assignmentsSubmitted = assignments.filter((a) => a.displayStatus === "submitted" || a.displayStatus === "graded").length;
  const assignmentsPending = assignments.filter((a) => a.displayStatus === "set" || a.displayStatus === "overdue").length;

  const testsToday = tests
    .filter((t) => {
      if (!t.gradedAt) return false;
      return new Date(t.gradedAt).toDateString() === now.toDateString();
    })
    .map((t) => `${t.title} (${t.subject ?? "Test"})`);

  // Topics from active chapters
  const recentTopics: string[] = [];
  if (prog && prog.curriculumCoverage.bySubject.length > 0) {
    for (const subj of prog.curriculumCoverage.bySubject) {
      if (subj.chapters.length > 0) {
        recentTopics.push(`${subj.subject}: ${subj.chapters[0].label}`);
      }
    }
  }

  // Needs attention
  const needsAttention: string[] = [];
  const overdueHw = todayHw.filter((h) => h.isOverdue);
  if (overdueHw.length > 0) {
    needsAttention.push(`${overdueHw.length} homework assignment overdue`);
  }
  if (attendanceStatus === "Absent") {
    needsAttention.push("Marked absent today");
  }

  let suggestedAction: string | null = null;
  if (overdueHw.length > 0) {
    suggestedAction = `Have your child spend 20 minutes completing "${overdueHw[0].title}".`;
  } else if (todayHw.length > 0 && homeworkCompleted < homeworkTotal) {
    suggestedAction = "Encourage finishing the remaining homework before dinner.";
  } else if (recentTopics.length > 0) {
    suggestedAction = `Ask your child to explain one key idea learned today from ${recentTopics[0]}.`;
  }

  return {
    date: dateStr,
    attendanceStatus,
    homeworkCompleted,
    homeworkTotal,
    assignmentsSubmitted,
    assignmentsPending,
    testsToday,
    recentTopics,
    recentAccuracy: prog?.assessments.averagePercentage ? Math.round(prog.assessments.averagePercentage) : null,
    needsAttention,
    suggestedAction,
  };
}

/**
 * Builds Today's Timeline from records that actually exist.
 *
 * A clock time is attached only when the source row has one (tests carry
 * `graded_at`). Attendance and homework expose a date but no time, so those
 * events carry no time rather than a plausible-looking invented slot.
 */
export async function getTodayTimeline(
  studentId: string,
): Promise<TimelineEvent[]> {
  const [todayHw, attSummary, tests] = await Promise.all([
    getTodayHomework(studentId).catch(() => []),
    getAttendanceSummary(studentId).catch(() => null),
    listTestResultsForStudent(studentId, 5).catch(() => []),
  ]);

  const events: TimelineEvent[] = [];

  // Attendance event
  if (attSummary?.todayStatus !== null && attSummary?.todayStatus !== undefined) {
    events.push({
      id: "att-today",
      // No `time`: attendance rows carry a date, not a time.
      title: "Attendance Recorded",
      description: attSummary.todayStatus ? "Marked Present in morning roll call" : "Marked Absent in morning roll call",
      category: "attendance",
      badge: attSummary.todayStatus ? "Present" : "Absent",
    });
  }

  // Homework events
  todayHw.forEach((hw) => {
    if (hw.status === "completed") {
      events.push({
        id: `hw-${hw.id}`,
        // No `time`: homework rows carry a due date, not a completion time.
        title: `Homework Completed: ${hw.title}`,
        description: `${hw.subject ?? "Homework"} marked complete${hw.due_date ? ` (due ${hw.due_date})` : ""}.`,
        category: "homework",
        badge: "Done",
      });
    } else {
      events.push({
        id: `hw-${hw.id}`,
        title: `Homework Assigned: ${hw.title}`,
        description: `Due date: ${hw.due_date ?? "Today"} · Status: ${hw.isOverdue ? "Overdue" : "Pending"}`,
        category: "homework",
        badge: hw.isOverdue ? "Overdue" : "Pending",
      });
    }
  });

  // Test events if any graded today
  const todayStr = new Date().toDateString();
  tests.forEach((t) => {
    if (t.gradedAt && new Date(t.gradedAt).toDateString() === todayStr) {
      events.push({
        id: `test-${t.id}`,
        // Real timestamp: `graded_at` is an actual column on the test row.
        time: new Date(t.gradedAt!).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Kolkata",
        }),
        title: `Test Graded: ${t.title}`,
        description: `Score: ${t.percentage ? Math.round(t.percentage) + "%" : "—"}${t.teacherFeedback ? ` · "${t.teacherFeedback}"` : ""}`,
        category: "test",
        badge: t.percentage ? `${Math.round(t.percentage)}%` : "Graded",
      });
    }
  });

  // No synthetic "day started" filler event. If nothing has been recorded for
  // this student today, the honest answer is an empty timeline, and the UI
  // hides the card entirely rather than asserting activity that did not happen.
  return events;
}

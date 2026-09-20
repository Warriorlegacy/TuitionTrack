"use server";

import { requireParentContext } from "@/lib/parent/auth";
import { getProgressOverview } from "@/lib/parent/progress";
import { getTodayHomework, getHomeworkCompletionRate, listHomeworkForStudent } from "@/lib/parent/homework";
import { listTestResultsForStudent, getSubjectPerformance } from "@/lib/parent/tests";
import { getAttendanceSummary } from "@/lib/parent/attendance";
import { listFeesForStudent } from "@/lib/parent/payments";
import { getParentInsights } from "@/lib/parent/insights";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ParentAiResponse {
  ok: boolean;
  answer?: string;
  evidence?: string[];
  suggestedQuestions?: string[];
  error?: string;
}

export async function askParentAiAction(
  childId: string,
  question: string,
): Promise<ParentAiResponse> {
  try {
    const trimmed = question.trim();
    if (!trimmed) {
      return { ok: false, error: "Please enter a question." };
    }

    // 1. Authorize parent and child link server-side (Section 54, 62)
    const context = await requireParentContext(childId);
    const activeChild = context.children.find((c) => c.student.id === childId);

    if (!activeChild) {
      return {
        ok: false,
        error: "Access denied. You can only query information for your own authorized child.",
      };
    }

    const student = activeChild.student;

    // 2. Fetch ground-truth facts across systems
    const [prog, todayHw, allHw, hwRate, attSummary, tests, subjectPerf, fees, insights] =
      await Promise.all([
        getProgressOverview(student.id, student.class).catch(() => null),
        getTodayHomework(student.id).catch(() => []),
        listHomeworkForStudent(student.id, "all").catch(() => []),
        getHomeworkCompletionRate(student.id, "month").catch(() => null),
        getAttendanceSummary(student.id).catch(() => null),
        listTestResultsForStudent(student.id, 10).catch(() => []),
        getSubjectPerformance(student.id).catch(() => []),
        listFeesForStudent(student.id).catch(() => []),
        getParentInsights(student.id, student.class).catch(() => null),
      ]);

    // 3. Prepare structured facts for answer generation
    const overdueHw = allHw.filter((h) => h.isOverdue);
    const pendingFees = fees.filter((f) => f.status === "unpaid" || f.status === "overdue");
    const avgTestScore =
      tests.length > 0
        ? Math.round(tests.reduce((acc, t) => acc + (t.percentage ?? 0), 0) / tests.length)
        : null;

    const lowerQ = trimmed.toLowerCase();
    let answer = "";
    const evidence: string[] = [];

    // Check for specific topics
    if (lowerQ.includes("homework") || lowerQ.includes("hw") || lowerQ.includes("pending")) {
      if (overdueHw.length > 0) {
        answer = `${student.name} has ${overdueHw.length} overdue homework assignment${overdueHw.length > 1 ? "s" : ""}: ${overdueHw.map((h) => `"${h.title}" (due ${h.due_date ?? "earlier"})`).join(", ")}.`;
        evidence.push(`${overdueHw.length} assignments past due date`);
      } else if (todayHw.length > 0) {
        const completed = todayHw.filter((h) => h.status === "completed").length;
        answer = `For today, ${student.name} has ${completed} of ${todayHw.length} homework assignment${todayHw.length > 1 ? "s" : ""} marked completed.`;
        evidence.push(`${completed}/${todayHw.length} completed today`);
      } else {
        answer = `There is no overdue or pending homework recorded for ${student.name} right now.`;
        if (hwRate && hwRate.rate !== null) {
          answer += ` Over the last 30 days, the homework completion rate is ${Math.round(hwRate.rate)}% (${hwRate.completed}/${hwRate.total}).`;
          evidence.push(`${Math.round(hwRate.rate)}% 30-day completion rate`);
        }
      }
    } else if (lowerQ.includes("attend") || lowerQ.includes("present") || lowerQ.includes("absent")) {
      const todayStatus =
        attSummary?.todayStatus === true
          ? "Present"
          : attSummary?.todayStatus === false
            ? "Absent"
            : "not recorded yet";

      answer = `Today's attendance is ${todayStatus}. Overall, ${student.name} has been present for ${attSummary?.daysPresent ?? 0} out of ${attSummary?.daysMarked ?? 0} recorded sessions (${attSummary?.percentPresent !== null && attSummary?.percentPresent !== undefined ? Math.round(attSummary.percentPresent) + "%" : "—"}).`;
      evidence.push(`${attSummary?.daysPresent ?? 0}/${attSummary?.daysMarked ?? 0} marked sessions present`);
    } else if (lowerQ.includes("test") || lowerQ.includes("exam") || lowerQ.includes("score") || lowerQ.includes("mark")) {
      if (tests.length === 0) {
        answer = `No graded test results have been published for ${student.name} yet. Results appear once your teacher completes grading.`;
      } else {
        const latest = tests[0];
        answer = `The latest graded assessment is "${latest.title}" (${latest.subject ?? "Assessment"}), with a score of ${latest.percentage !== null ? Math.round(latest.percentage) + "%" : "graded"}.${latest.teacherFeedback ? ` Teacher note: "${latest.teacherFeedback}".` : ""} Across all ${tests.length} graded tests, the average score is ${avgTestScore}%.`;
        evidence.push(`Latest: ${latest.title} (${latest.percentage ? Math.round(latest.percentage) + "%" : "—"})`);
        evidence.push(`Average: ${avgTestScore}% across ${tests.length} tests`);
      }
    } else if (lowerQ.includes("revise") || lowerQ.includes("revision") || lowerQ.includes("weak") || lowerQ.includes("improve")) {
      const lowTests = tests.filter((t) => t.percentage !== null && t.percentage < 65);
      if (lowTests.length > 0) {
        const t = lowTests[0];
        answer = `Based on test outcomes, revision is recommended for ${t.subject ?? "topics"} related to "${t.title}" (scored ${Math.round(t.percentage!)}%). Spending 15–20 minutes re-attempting missed questions is recommended.`;
        evidence.push(`Test score ${Math.round(t.percentage!)}% on "${t.title}"`);
      } else if (insights?.actionPlan && insights.actionPlan.length > 0) {
        const rev = insights.actionPlan.find((a) => a.action === "Revise" || a.action === "Practice");
        if (rev) {
          answer = `Recommended focus: ${rev.title}. ${rev.description}`;
          evidence.push(`Action plan step: ${rev.title}`);
        } else {
          answer = `${student.name} is performing steadily with no critical revision flags. Continuing regular practice on current syllabus chapters is recommended.`;
        }
      } else {
        answer = `${student.name} has no flagged weak areas based on currently recorded tests and homework.`;
      }
    } else if (lowerQ.includes("ptm") || lowerQ.includes("meeting") || lowerQ.includes("teacher")) {
      const weakPoints: string[] = [];
      const strongPoints: string[] = [];

      subjectPerf.forEach((s) => {
        if (s.averagePercentage < 65) weakPoints.push(s.subject);
        else if (s.averagePercentage >= 80) strongPoints.push(s.subject);
      });

      answer = `Here are recommended points to discuss with the teacher for ${student.name}:\n` +
        `1. Progress in ${strongPoints.length > 0 ? strongPoints.join(", ") : "core subjects"}: Acknowledge solid conceptual mastery.\n` +
        `2. Focus areas: ${weakPoints.length > 0 ? `Ask for targeted practice materials in ${weakPoints.join(", ")}.` : "Clarify upcoming syllabus milestones and exam schedule."}\n` +
        `3. Study routine: Check if homework submission timing and classroom engagement align with teacher expectations.`;

      evidence.push(`Based on ${subjectPerf.length} subject performance records`);
    } else if (lowerQ.includes("fee") || lowerQ.includes("pay") || lowerQ.includes("due")) {
      if (pendingFees.length > 0) {
        const total = pendingFees.reduce((sum, f) => sum + f.amount, 0);
        answer = `There is ₹${total.toLocaleString("en-IN")} pending in tuition fees across ${pendingFees.length} invoice${pendingFees.length > 1 ? "s" : ""}. You can view the UPI ID and submit payment proof under the Fees section.`;
        evidence.push(`₹${total.toLocaleString("en-IN")} pending fees`);
      } else {
        answer = `All tuition fees for ${student.name} are currently up to date with no pending dues.`;
        evidence.push("0 pending fees");
      }
    } else {
      // General comprehensive academic summary
      answer = `Summary for ${student.name} (Class ${student.class}):\n` +
        `• Attendance: ${attSummary?.percentPresent !== null && attSummary?.percentPresent !== undefined ? Math.round(attSummary.percentPresent) + "%" : "Not recorded"}\n` +
        `• Homework Rate: ${hwRate?.rate !== null && hwRate?.rate !== undefined ? Math.round(hwRate.rate) + "%" : "No assignments yet"}\n` +
        `• Assessment Average: ${avgTestScore !== null ? avgTestScore + "%" : "No tests graded yet"}\n` +
        `• Syllabus Covered: ${prog?.curriculumCoverage.chaptersCovered ?? 0} chapters\n` +
        `• Concepts Mastered: ${prog?.conceptMastery.conceptsMastered ?? 0} concepts\n` +
        (overdueHw.length > 0 ? `⚠ Attention: ${overdueHw.length} homework assignment overdue.` : "✓ All homework up to date.");

      evidence.push("Aggregated from attendance, homework, test and progress records");
    }

    // Log the AI inquiry for security & privacy auditing (Section 67)
    try {
      const supabase = createSupabaseServerClient();
      await supabase.from("audit_logs").insert({
        actor_id: context.user?.id ?? "anonymous",
        action: "parent_ai_query",
        entity: "student",
        metadata: {
          student_id: student.id,
          question: trimmed,
          evidence_count: evidence.length,
        },
      });
    } catch {
      // Non-blocking audit log
    }

    return {
      ok: true,
      answer,
      evidence,
      suggestedQuestions: [
        "What homework is overdue?",
        "Which concepts need revision?",
        "What should I ask during the PTM?",
        "How has attendance been this month?",
      ],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to process your question";
    return { ok: false, error: msg };
  }
}

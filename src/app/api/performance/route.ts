import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Database } from "@/lib/db/types";
import { requireTeacherContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const performanceGetSchema = z.object({
  student_id: z.string().uuid(),
});

const performancePostSchema = z.object({
  student_id: z.string().uuid(),
  period_label: z.string().optional(),
  attendance_pct: z.number().min(0).max(100).optional(),
  score_1: z.number().min(0).optional(),
  score_2: z.number().min(0).optional(),
  score_3: z.number().min(0).optional(),
  homework_pct: z.number().min(0).max(100).optional(),
  tutor_notes: z.string().optional(),
});

export const dynamic = "force-dynamic";

async function verifyStudentBelongsToTeacher(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  studentId: string
) {
  const { data: student } = await supabase
    .from("students")
    .select("id, name, teacher_id")
    .eq("id", studentId)
    .maybeSingle();

  if (!student || student.teacher_id !== userId) {
    return { ok: false as const, student: null };
  }
  return { ok: true as const, student };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentIdParam = searchParams.get("student_id");

    if (!studentIdParam) {
      return NextResponse.json(
        { error: "Missing student_id query parameter" },
        { status: 400 }
      );
    }

    const parsed = performanceGetSchema.safeParse({ student_id: studentIdParam });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid student_id", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const context = await requireTeacherContext();
    if (!context.configured || !context.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseServerClient();
    const { ok, student } = await verifyStudentBelongsToTeacher(
      supabase,
      context.user.id,
      parsed.data.student_id
    );

    if (!ok || !student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const { data: records, error: recordsError } = await supabase
      .from("performance_records")
      .select("id, student_id, period_label, attendance_pct, score_1, score_2, score_3, homework_pct, tutor_notes, risk_score, created_at, updated_at")
      .eq("student_id", parsed.data.student_id)
      .order("created_at", { ascending: false });

    if (recordsError) {
      console.error("Failed to fetch performance records:", recordsError);
      return NextResponse.json(
        { error: "Failed to fetch performance records", details: recordsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        student: { id: student.id, name: student.name },
        records: records ?? [],
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Unhandled error in performance GET:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = performancePostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { student_id, period_label, ...rest } = parsed.data;

    const context = await requireTeacherContext();
    if (!context.configured || !context.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseServerClient();
    const { ok, student } = await verifyStudentBelongsToTeacher(
      supabase,
      context.user.id,
      student_id
    );

    if (!ok || !student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const payload = {
      student_id,
      ...(period_label ? { period_label } : {}),
      ...(rest.attendance_pct !== undefined ? { attendance_pct: rest.attendance_pct } : {}),
      ...(rest.score_1 !== undefined ? { score_1: rest.score_1 } : {}),
      ...(rest.score_2 !== undefined ? { score_2: rest.score_2 } : {}),
      ...(rest.score_3 !== undefined ? { score_3: rest.score_3 } : {}),
      ...(rest.homework_pct !== undefined ? { homework_pct: rest.homework_pct } : {}),
      ...(rest.tutor_notes !== undefined ? { tutor_notes: rest.tutor_notes } : {}),
    } as Database["public"]["Tables"]["performance_records"]["Insert"];

    const { data: inserted, error: upsertError } = await supabase
      .from("performance_records")
      .upsert(payload, {
        onConflict: "student_id,period_label",
      })
      .select("id, student_id, period_label, attendance_pct, score_1, score_2, score_3, homework_pct, tutor_notes, risk_score, created_at, updated_at")
      .single();

    if (upsertError) {
      console.error("Failed to upsert performance record:", upsertError);
      return NextResponse.json(
        { error: "Failed to save performance record", details: upsertError.message },
        { status: 500 }
      );
    }

    revalidatePath(`/app/students/${student_id}`);
    revalidatePath("/app/reports");

    return NextResponse.json(inserted, { status: 200 });
  } catch (err) {
    console.error("Unhandled error in performance POST:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

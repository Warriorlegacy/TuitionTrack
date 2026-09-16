import { getAuthContext } from "@/lib/auth";
import { NextResponse } from "next/server";

// Shared guard: any authenticated role may call AI, but only for students
// they can access (teacher owns, parent/student linked). No service-role.
export async function requireStudentAccess(student_id: string) {
  const context = await getAuthContext();
  if (!context.configured || !context.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as NextResponse, context: null };
  }
  const allowed =
    context.role === "teacher"
      ? context.accessibleStudents.some((s) => s.id === student_id) ||
        context.teacherIds.length > 0 // teacher may start loop for owned student; RLS re-checks
      : context.accessibleStudents.some((s) => s.id === student_id);
  if (!allowed) {
    return { error: NextResponse.json({ error: "Forbidden: unknown student" }, { status: 403 }) as NextResponse, context: null };
  }
  return { error: null as NextResponse | null, context };
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

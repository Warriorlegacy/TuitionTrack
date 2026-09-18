import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { generateHomeworkAssignment, type HomeworkGenerationRequest } from "@/lib/homework/variation-engine";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const context = await requireAuthContext();
    if (context.role !== "teacher") {
      return NextResponse.json({ error: "Only teachers can generate homework." }, { status: 403 });
    }

    const body = (await req.json()) as HomeworkGenerationRequest;

    if (!body.chapterSlug) {
      return NextResponse.json({ error: "chapterSlug is required." }, { status: 400 });
    }

    const assignment = await generateHomeworkAssignment(body);

    return NextResponse.json({
      success: true,
      assignment,
    });
  } catch (error) {
    console.error("AI Homework Generation failed:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to generate homework." },
      { status: 500 }
    );
  }
}

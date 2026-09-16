import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// DELETE /api/ai/keys/:id — revoke a key
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const context = await requireAuthContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("user_ai_keys")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("user_id", context.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH /api/ai/keys/:id — update label / model prefs
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const context = await requireAuthContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseServerClient();

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const updates: { label?: string; metadata?: Record<string, unknown>; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.label === "string") updates.label = body.label;
  if (typeof body.default_model === "string") {
    updates.metadata = {
      ...((body.current_metadata as Record<string, unknown> | undefined) ?? {}),
      default_model: body.default_model,
    };
  }

  const { error } = await supabase
    .from("user_ai_keys")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", context.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

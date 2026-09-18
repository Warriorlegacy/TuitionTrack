import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ApprovalPayload = {
  channel?: string;
  recipient_type?: string;
  to?: string | null;
  body?: string;
  dedupe_key?: string;
  template_key?: string;
  variables?: Record<string, unknown>;
};

type ApprovalRow = {
  id: string;
  org_id: string;
  agent_run_id: string | null;
  kind: string;
  payload: ApprovalPayload;
  preview: string;
  edited_payload: ApprovalPayload | null;
  status: string;
};

// PATCH /api/approvals/:id — {action: 'approve'|'edit-approve'|'reject',
// edited_payload?}. Approve inserts one message_outbox row (dedupe-safe).
// Kill-switch toggle shares this route: PATCH /api/approvals/rules with
// {action:'kill-switch', agent, org_id, enabled} (staff-only via RLS).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const context = await requireAuthContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!context.canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = createSupabaseServerClient();

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (body.action === "kill-switch") {
    if (typeof body.agent !== "string" || typeof body.org_id !== "string" || typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "agent, org_id, enabled required" }, { status: 400 });
    }
    const { error } = await supabase.from("automation_rules").upsert(
      {
        org_id: body.org_id,
        agent: body.agent,
        enabled: body.enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,agent" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!["approve", "edit-approve", "reject"].includes(body.action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("approvals")
    .select("id, org_id, agent_run_id, kind, payload, preview, edited_payload, status")
    .eq("id", params.id)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  const approval = data as unknown as ApprovalRow;
  if (approval.status !== "pending") {
    return NextResponse.json({ error: `Already ${approval.status}` }, { status: 409 });
  }

  const now = new Date().toISOString();
  if (body.action === "reject") {
    const { error: upErr } = await supabase
      .from("approvals")
      .update({ status: "rejected", decided_by: context.user.id, decided_at: now })
      .eq("id", approval.id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // approve | edit-approve
  const edited = (body.edited_payload as ApprovalPayload | undefined) ?? undefined;
  if (body.action === "edit-approve" && (!edited || typeof edited.body !== "string" || !edited.body.trim())) {
    return NextResponse.json({ error: "edited_payload.body required" }, { status: 400 });
  }
  const finalBody = body.action === "edit-approve" ? edited!.body! : (approval.payload.body ?? approval.preview);
  const finalPayload: ApprovalPayload = {
    ...approval.payload,
    ...(edited ?? {}),
    body: finalBody,
  };

  if (approval.kind === "message") {
    if (!finalPayload.to) {
      return NextResponse.json({ error: "No recipient phone on this approval" }, { status: 400 });
    }
    // Dedupe: same (org, dedupe_key) already queued/sent → don't double-message.
    if (finalPayload.dedupe_key) {
      const { data: dupe } = await supabase
        .from("message_outbox")
        .select("id")
        .eq("org_id", approval.org_id)
        .eq("dedupe_key", finalPayload.dedupe_key)
        .limit(1)
        .maybeSingle();
      if (dupe) {
        await supabase
          .from("approvals")
          .update({
            status: body.action === "edit-approve" ? "edited" : "approved",
            edited_payload: body.action === "edit-approve" ? finalPayload : null,
            decided_by: context.user.id,
            decided_at: now,
          })
          .eq("id", approval.id);
        return NextResponse.json({ ok: true, deduped: true });
      }
    }
    const { error: outErr } = await supabase.from("message_outbox").insert({
      org_id: approval.org_id,
      channel: finalPayload.channel ?? "whatsapp",
      to_identity: finalPayload.to,
      recipient_type: finalPayload.recipient_type ?? "parent",
      template_key: finalPayload.template_key ?? null,
      variables: finalPayload.variables ?? {},
      body: finalBody,
      agent_run_id: approval.agent_run_id,
      dedupe_key: finalPayload.dedupe_key ?? null,
      status: "queued",
    });
    if (outErr) return NextResponse.json({ error: outErr.message }, { status: 500 });
  }

  const { error: upErr } = await supabase
    .from("approvals")
    .update({
      status: body.action === "edit-approve" ? "edited" : "approved",
      edited_payload: body.action === "edit-approve" ? finalPayload : null,
      decided_by: context.user.id,
      decided_at: now,
    })
    .eq("id", approval.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

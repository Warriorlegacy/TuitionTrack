import { BellIcon, CalendarIcon, IndianRupeeIcon, BookOpenIcon, CalendarCheckIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { requireParentContext } from "@/lib/parent/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Notifications · TuitionTrack" };

type AuditEntry = {
  id: string;
  action: string;
  entity: string;
  created_at: string;
  metadata: Record<string, unknown>;
};

function getEventIcon(action: string) {
  if (action.includes("payment")) return IndianRupeeIcon;
  if (action.includes("homework") || action.includes("assignment")) return BookOpenIcon;
  if (action.includes("attendance")) return CalendarCheckIcon;
  return CalendarIcon;
}

function getEventLabel(action: string): string {
  const map: Record<string, string> = {
    payment_proof_submitted: "Payment proof submitted",
    payment_proof_verified: "Payment verified by teacher",
    payment_proof_rejected: "Payment proof rejected",
    homework_completed: "Homework marked complete",
    homework_assigned: "New homework assigned",
    assignment_submitted: "Assignment submitted",
    attendance_marked: "Attendance recorded",
    invite_accepted: "Parent invitation accepted",
    guardian_link_created: "Guardian link created",
  };
  return map[action] ?? action.replaceAll("_", " ");
}

function getEventDescription(action: string, meta: Record<string, unknown>): string | null {
  if (action === "payment_proof_submitted") {
    const amount = meta?.amount;
    const utr = meta?.utr_reference;
    if (amount && utr) return `₹${Number(amount).toLocaleString("en-IN")} · UTR ${utr}`;
    if (amount) return `₹${Number(amount).toLocaleString("en-IN")}`;
  }
  if (action === "payment_proof_rejected") {
    return meta?.rejection_reason ? `Reason: ${meta.rejection_reason}` : null;
  }
  if (action === "homework_assigned") {
    const bits: string[] = [];
    if (typeof meta?.studentName === "string" && meta.studentName) bits.push(String(meta.studentName));
    if (typeof meta?.title === "string" && meta.title) bits.push(String(meta.title));
    if (typeof meta?.subject === "string" && meta.subject) bits.push(String(meta.subject));
    if (typeof meta?.dueDate === "string" && meta.dueDate) {
      bits.push(`Due ${new Date(String(meta.dueDate)).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`);
    }
    return bits.length > 0 ? bits.join(" · ") : null;
  }
  return null;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ParentNotificationsPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const requested = typeof searchParams?.child === "string" ? searchParams.child : undefined;
  const context = await requireParentContext(requested);

  if (!context.user) {
    return (
      <div className="mx-auto max-w-3xl py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Notifications</h1>
        <p className="mt-2 text-sm text-slate-600">No child linked yet.</p>
      </div>
    );
  }

  // Read audit_logs for this guardian's activity
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, entity, created_at, metadata")
    .eq("actor_id", context.user.id)
    .order("created_at", { ascending: false })
    .limit(60);

  const events: AuditEntry[] = (data as AuditEntry[] | null) ?? [];

  // Group by date (local date string)
  const groups = new Map<string, AuditEntry[]>();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);

  for (const ev of events) {
    const date = ev.created_at.slice(0, 10);
    const label =
      date === today ? "Today" : date === yesterday ? "Yesterday" : new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "long" });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(ev);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Notifications</h1>
        <p className="mt-1 text-sm text-slate-600">Your account activity</p>
      </div>

      {events.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <BellIcon className="mx-auto size-8 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-medium text-slate-600">No activity yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Payment submissions, attendance updates, and other events will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(groups.entries()).map(([label, evs]) => (
            <section key={label}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {label}
              </p>
              <div className="space-y-2">
                {evs.map((ev) => {
                  const Icon = getEventIcon(ev.action);
                  const meta = (ev.metadata as Record<string, unknown>) ?? {};
                  const desc = getEventDescription(ev.action, meta);

                  return (
                    <Card key={ev.id} className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
                      <div className="flex items-start gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                          <Icon className="size-4 text-slate-600" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {getEventLabel(ev.action)}
                          </p>
                          {desc && (
                            <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
                          )}
                          <p className="mt-1 text-xs text-slate-400">{fmtDate(ev.created_at)}</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type ApprovalItem = {
  id: string;
  org_id: string;
  kind: string;
  preview: string;
  status: string;
  created_at: string;
  payload: {
    to?: string | null;
    body?: string;
    template_key?: string;
    dedupe_key?: string;
    student_id?: string;
    amount?: string;
    subject?: string;
    chapter?: string;
    class_level?: string;
    tiers?: Record<string, { stem: string; marks: number }[]>;
    checker?: { passed: number; failed: unknown[] };
  };
};

export type RunItem = {
  id: string;
  agent: string;
  trigger: string;
  status: string;
  cost_paise: number;
  model: string | null;
  created_at: string;
};

export type RuleItem = { org_id: string; agent: string; enabled: boolean; autonomy: string };

function waLink(phone: string | null | undefined, body: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

export function ApprovalsView({
  approvals,
  runs,
  rules,
}: {
  approvals: ApprovalItem[];
  runs: RunItem[];
  rules: RuleItem[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: string, editedBody?: string) {
    setBusy(id + action);
    try {
      const res = await fetch(`/api/approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editedBody !== undefined
            ? { action, edited_payload: { body: editedBody } }
            : { action },
        ),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        alert(j?.error ?? "Action failed");
        return;
      }
      setEditing(null);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function toggleRule(rule: RuleItem) {
    setBusy(`rule-${rule.org_id}-${rule.agent}`);
    try {
      const res = await fetch("/api/approvals/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "kill-switch",
          agent: rule.agent,
          org_id: rule.org_id,
          enabled: !rule.enabled,
        }),
      });
      if (!res.ok) alert("Toggle failed");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pending approvals ({approvals.length})</CardTitle>
          <CardDescription>Drafted by agents at L3. Approve, edit, or reject — under three minutes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {approvals.length === 0 && <p className="text-sm text-slate-500">Queue is clear.</p>}
          {approvals.map((a) => {
            const body = a.payload.body ?? a.preview;
            const link = a.kind === "message" ? waLink(a.payload.to, body) : null;
            const isEditing = editing === a.id;
            return (
              <div key={a.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{a.kind}</span>
                  {a.payload.template_key && <span>· {a.payload.template_key}</span>}
                  {(a.kind === "worksheet" || a.kind === "grade") && (a.payload.subject || a.payload.chapter) && (
                    <span>
                      · {[a.payload.subject, a.payload.chapter, a.payload.class_level].filter(Boolean).join(" — ")}
                      {a.payload.tiers &&
                        ` · ${Object.entries(a.payload.tiers)
                          .map(([t, qs]) => `${t} ${qs.length}`)
                          .join(" / ")}`}
                      {a.payload.checker && ` · checker ${a.payload.checker.passed} passed`}
                    </span>
                  )}
                  <span>· {new Date(a.created_at).toLocaleString("en-IN")}</span>
                </div>
                {isEditing ? (
                  <textarea
                    className="mt-2 w-full rounded-md border p-2 text-sm"
                    rows={4}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                ) : (
                  <p className="mt-2 whitespace-pre-line text-sm">{a.preview}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {isEditing ? (
                    <>
                      <Button
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => act(a.id, "edit-approve", draft)}
                      >
                        Save + Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" disabled={busy !== null} onClick={() => act(a.id, "approve")}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(a.id);
                          setDraft(body);
                        }}
                      >
                        Edit + Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy !== null}
                        onClick={() => act(a.id, "reject")}
                      >
                        Reject
                      </Button>
                      {link && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-7 items-center rounded-lg px-2.5 text-[0.8rem] font-medium text-primary underline-offset-4 hover:underline"
                        >
                          Open in WhatsApp ↗
                        </a>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kill switches</CardTitle>
          <CardDescription>Global off stops every outbound message within a minute. Queued items wait, they don&apos;t vanish.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {rules.length === 0 && <p className="text-sm text-slate-500">No rules yet — everything defaults to enabled.</p>}
          {rules.map((r) => (
            <div key={`${r.org_id}-${r.agent}`} className="flex items-center justify-between rounded-lg border px-4 py-2 text-sm">
              <span>
                <span className="font-medium">{r.agent}</span>
                <span className="text-slate-500"> · {r.autonomy} · {r.enabled ? "on" : "OFF"}</span>
              </span>
              <Button
                size="sm"
                variant={r.enabled ? "outline" : "destructive"}
                disabled={busy !== null}
                onClick={() => toggleRule(r)}
              >
                {r.enabled ? "Turn off" : "Turn on"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent agent runs</CardTitle>
          <CardDescription>Every agent action, with cost. No row means it didn&apos;t happen.</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-slate-500">No runs yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="py-2 pr-2">Agent</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Cost</th>
                  <th className="py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-2 font-medium">{r.agent}</td>
                    <td className="py-2 pr-2">{r.status}</td>
                    <td className="py-2 pr-2">₹{((r.cost_paise ?? 0) / 100).toFixed(2)}</td>
                    <td className="py-2 text-slate-500">{new Date(r.created_at).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

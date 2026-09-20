import { UserCircleIcon, ShieldCheckIcon, LinkIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { requireParentContext } from "@/lib/parent/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Profile · TuitionTrack" };

const RELATIONSHIP_LABELS: Record<string, string> = {
  father: "Father",
  mother: "Mother",
  guardian: "Guardian",
  other: "Other guardian",
};

export default async function ParentProfilePage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const requested = typeof searchParams?.child === "string" ? searchParams.child : undefined;
  const context = await requireParentContext(requested);

  if (!context.user) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Profile</h1>
        <p className="mt-2 text-sm text-slate-600">Please sign in to view your profile.</p>
      </div>
    );
  }

  // Fetch all guardian relationships for this user
  const supabase = createSupabaseServerClient();
  const { data: links } = await supabase
    .from("guardian_student_relationships")
    .select(
      `id, relationship_type, status, permissions, created_at,
       student:students(id, name, class, teacher_id)`,
    )
    .eq("guardian_user_id", context.user.id)
    .eq("status", "active")
    .order("created_at");

  type RelRaw = {
    id: string;
    relationship_type: string;
    status: string;
    permissions: Record<string, unknown>;
    created_at: string;
    student: { id: string; name: string; class: string; teacher_id: string } | null;
  };

  const relationships: RelRaw[] = (links as unknown as RelRaw[]) ?? [];

  return (
    <div className="mx-auto max-w-lg space-y-6 py-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Profile</h1>

      {/* Account info */}
      <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-slate-100">
            <UserCircleIcon className="size-6 text-slate-500" aria-hidden />
          </div>
          <div>
            <p className="font-semibold text-slate-900">
              {context.profile?.name ?? "Parent / Guardian"}
            </p>
            <p className="text-sm text-slate-500">{context.user.email}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Account type</span>
            <span className="font-medium text-slate-900">Parent / Guardian</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Member since</span>
            <span className="font-medium text-slate-900">
              {new Date(context.user.created_at ?? "").toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </Card>

      {/* Linked children */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <LinkIcon className="size-3.5" aria-hidden />
          Linked children ({relationships.length})
        </h2>

        {relationships.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-600">No children linked to your account yet.</p>
            <p className="mt-1 text-xs text-slate-400">
              Ask your child&apos;s teacher to send an invitation link.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {relationships.map((rel) => {
              if (!rel.student) return null;
              const perms = rel.permissions ?? {};
              const enabledPerms = Object.entries(perms)
                .filter(([, v]) => v === true)
                .map(([k]) =>
                  k
                    .replace("view_", "")
                    .replace("_", " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase()),
                );

              return (
                <Card key={rel.id} className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{rel.student.name}</p>
                      <p className="text-sm text-slate-500">Class {rel.student.class}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        Active
                      </span>
                      <p className="mt-1 text-xs text-slate-400">
                        {RELATIONSHIP_LABELS[rel.relationship_type] ?? "Guardian"}
                      </p>
                    </div>
                  </div>

                  {enabledPerms.length > 0 && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <p className="text-xs text-slate-400">Visible to you:</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {enabledPerms.map((p) => (
                          <span
                            key={p}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="mt-3 text-xs text-slate-400">
                    Linked{" "}
                    {new Date(rel.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Privacy note */}
      <Card className="flex items-start gap-3 rounded-2xl border-slate-200 bg-slate-50 p-4">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
        <p className="text-xs leading-relaxed text-slate-500">
          Your access to each child&apos;s records is controlled by the teacher who issued your
          invitation. You can only see what is explicitly enabled on each relationship. To request
          access to additional data, contact the teacher directly.
        </p>
      </Card>
    </div>
  );
}

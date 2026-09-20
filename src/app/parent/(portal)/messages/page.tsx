import { MegaphoneIcon, CalendarIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { requireParentContext } from "@/lib/parent/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Messages · TuitionTrack" };

type Announcement = {
  id: string;
  title: string;
  message: string;
  created_at: string;
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) === 1 ? "" : "s"} ago`;

  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export default async function ParentMessagesPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const requested = typeof searchParams?.child === "string" ? searchParams.child : undefined;
  const context = await requireParentContext(requested);

  if (!context.user) {
    return (
      <div className="mx-auto max-w-3xl py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Messages</h1>
        <p className="mt-2 text-sm text-slate-600">No child linked yet.</p>
      </div>
    );
  }

  // Fetch announcements visible to parents (teacher_id scope via RLS)
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("announcements")
    .select("id, title, message, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const announcements: Announcement[] = (data as Announcement[] | null) ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Messages</h1>
        <p className="mt-1 text-sm text-slate-600">
          Announcements from your child&apos;s teacher
        </p>
      </div>

      {/* Info note */}
      <Card className="rounded-2xl border-slate-200 bg-slate-50 p-4">
        <p className="text-xs leading-relaxed text-slate-500">
          This section shows announcements published by the teacher. Direct two-way messaging
          will be available in a future update. For urgent matters, contact the teacher via the
          number on file.
        </p>
      </Card>

      {announcements.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <MegaphoneIcon className="mx-auto size-8 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-medium text-slate-600">No announcements yet</p>
          <p className="mt-1 text-xs text-slate-400">
            When the teacher posts an announcement, it will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id} className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{a.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{a.message}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                <CalendarIcon className="size-3" aria-hidden />
                {fmtDate(a.created_at)}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

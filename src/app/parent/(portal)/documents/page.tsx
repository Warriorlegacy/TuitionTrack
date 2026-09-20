import { FileTextIcon, ReceiptIcon, ExternalLinkIcon, ShieldCheckIcon, FolderOpenIcon } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Card } from "@/components/ui/card";
import { requireParentContext } from "@/lib/parent/auth";
import { listFeesForStudent, listProofsForGuardian } from "@/lib/parent/payments";

export const dynamic = "force-dynamic";

export const metadata = { title: "Documents · TuitionTrack" };

export default async function ParentDocumentsPage({
  searchParams,
}: {
  searchParams?: { child?: string };
}) {
  const requested = typeof searchParams?.child === "string" ? searchParams.child : undefined;
  const context = await requireParentContext(requested);
  const child = context.activeChild;

  if (!child) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Document Center"
          description="Receipts, progress reports and shared academic files."
        />
        <Empty className="border border-slate-200 bg-white">
          <EmptyTitle>No child selected</EmptyTitle>
          <EmptyDescription>
            Select a child from the switcher to view their academic documents.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const student = child.student;

  const [, allProofs] = await Promise.all([
    listFeesForStudent(student.id).catch(() => []),
    context.user ? listProofsForGuardian(context.user.id).catch(() => []) : [],
  ]);

  const verifiedProofs = allProofs.filter(
    (p) => p.student_id === student.id && (p.status === "verified" || p.status === "proof_submitted"),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Center"
        description={`Secure academic documents, official receipts, and report cards for ${student.name}.`}
      />

      {/* Quick categories */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ReceiptIcon className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Fee Receipts
              </p>
              <p className="text-lg font-bold text-slate-900">
                {verifiedProofs.length} Available
              </p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <FileTextIcon className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Report Cards
              </p>
              <p className="text-lg font-bold text-slate-900">Active Term</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <FolderOpenIcon className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Curriculum
              </p>
              <p className="text-lg font-bold text-slate-900">NCERT Class {student.class}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Available Documents Section */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Official Records & Receipts</h2>

        {/* Report Card Document Item */}
        <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft transition hover:border-slate-300">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                <FileTextIcon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  Term 1 Academic Progress Report Card
                </p>
                <p className="text-xs text-slate-500">
                  Class {student.class} · Academic Year 2026–2027
                </p>
              </div>
            </div>
            <Link
              href={`/parent/reports?tab=card${requested ? `&child=${requested}` : ""}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              View & Print
              <ExternalLinkIcon className="size-3" />
            </Link>
          </div>
        </Card>

        {/* Fee Receipts */}
        {verifiedProofs.map((proof) => (
          <Card
            key={proof.id}
            className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft transition hover:border-slate-300"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <ReceiptIcon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    Tuition Fee Payment Receipt — ₹{proof.amount.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-slate-500">
                    UTR: {proof.utr_reference} · {new Date(proof.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  {proof.status === "verified" ? "Verified" : "Submitted"}
                </span>
                <Link
                  href={`/parent/fees${requested ? `?child=${requested}` : ""}`}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Details
                </Link>
              </div>
            </div>
          </Card>
        ))}

        {/* Syllabus Resource Item */}
        <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft transition hover:border-slate-300">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                <FolderOpenIcon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  NCERT Curriculum Syllabus & Learning Objectives
                </p>
                <p className="text-xs text-slate-500">
                  Active syllabus tracking for Class {student.class}
                </p>
              </div>
            </div>
            <Link
              href={`/parent/syllabus${requested ? `?child=${requested}` : ""}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Open Syllabus
              <ExternalLinkIcon className="size-3" />
            </Link>
          </div>
        </Card>
      </section>

      {/* Security notice */}
      <Card className="flex items-start gap-3 rounded-2xl border-slate-200 bg-slate-50 p-4">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
        <p className="text-xs leading-relaxed text-slate-500">
          Document access is secured by guardian link verification. Official documents for {student.name} are accessible exclusively to authorized guardians.
        </p>
      </Card>
    </div>
  );
}

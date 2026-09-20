"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BanIcon,
  CheckIcon,
  CopyIcon,
  GraduationCapIcon,
  HeartHandshakeIcon,
  PlusIcon,
  QrCodeIcon,
  RotateCwIcon,
  SearchIcon,
  Share2Icon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PortalQrDialog } from "@/components/shared/portal-qr-dialog";
import {
  generatePortalLinkAction,
  revokePortalAccessAction,
} from "@/actions/portal-access";
import type { StudentPortalStatus, PortalType, PortalGrantStatus } from "@/lib/portal-access/types";

type FilterType = "all" | "parent" | "student" | "active" | "pending" | "revoked";

export function PortalAccessManager({
  students,
  stats,
}: {
  students: StudentPortalStatus[];
  stats: {
    totalStudents: number;
    parentsActive: number;
    parentsPending: number;
    studentsActive: number;
    studentsPending: number;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  // QR Modal state
  const [qrModal, setQrModal] = useState<{
    open: boolean;
    title: string;
    subtitle: string;
    url: string;
  }>({ open: false, title: "", subtitle: "", url: "" });

  // Fast generation modal state
  const [generateModal, setGenerateModal] = useState<{
    open: boolean;
    studentId: string;
    studentName: string;
    portalType: PortalType;
    targetEmail: string;
  }>({ open: false, studentId: "", studentName: "", portalType: "parent", targetEmail: "" });

  // Generated link result modal state
  const [resultModal, setResultModal] = useState<{
    open: boolean;
    title: string;
    studentName: string;
    portalType: PortalType;
    url: string;
    expiresAt: string;
  }>({ open: false, title: "", studentName: "", portalType: "parent", url: "", expiresAt: "" });

  // Copied indicator
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Flatten students into portal rows
  const portalRows = useMemo(() => {
    const rows: {
      key: string;
      studentId: string;
      studentName: string;
      studentClass: string;
      portalType: PortalType;
      status: PortalGrantStatus | "not_generated";
      grantId?: string;
      expiresAt?: string;
      lastUsedAt?: string | null;
      targetEmail?: string | null;
      parentEmail?: string | null;
      studentEmail?: string | null;
    }[] = [];

    students.forEach((s) => {
      // Parent row
      rows.push({
        key: `${s.studentId}-parent`,
        studentId: s.studentId,
        studentName: s.studentName,
        studentClass: s.studentClass,
        portalType: "parent",
        status: s.parentGrant ? s.parentGrant.status : "not_generated",
        grantId: s.parentGrant?.id,
        expiresAt: s.parentGrant?.expiresAt,
        lastUsedAt: s.parentGrant?.lastUsedAt,
        targetEmail: s.parentGrant?.targetEmail,
        parentEmail: s.parentEmail,
        studentEmail: s.studentEmail,
      });

      // Student row
      rows.push({
        key: `${s.studentId}-student`,
        studentId: s.studentId,
        studentName: s.studentName,
        studentClass: s.studentClass,
        portalType: "student",
        status: s.studentGrant ? s.studentGrant.status : "not_generated",
        grantId: s.studentGrant?.id,
        expiresAt: s.studentGrant?.expiresAt,
        lastUsedAt: s.studentGrant?.lastUsedAt,
        targetEmail: s.studentGrant?.targetEmail,
        parentEmail: s.parentEmail,
        studentEmail: s.studentEmail,
      });
    });

    return rows;
  }, [students]);

  // Filter & Search
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return portalRows.filter((row) => {
      // Filter tab
      if (filter === "parent" && row.portalType !== "parent") return false;
      if (filter === "student" && row.portalType !== "student") return false;
      if (filter === "active" && row.status !== "active") return false;
      if (filter === "pending" && row.status !== "pending") return false;
      if (filter === "revoked" && row.status !== "revoked") return false;

      // Query search
      if (!q) return true;
      return (
        row.studentName.toLowerCase().includes(q) ||
        row.studentClass.toLowerCase().includes(q) ||
        (row.parentEmail && row.parentEmail.toLowerCase().includes(q)) ||
        (row.studentEmail && row.studentEmail.toLowerCase().includes(q)) ||
        (row.targetEmail && row.targetEmail.toLowerCase().includes(q))
      );
    });
  }, [portalRows, search, filter]);

  const handleGenerate = (studentId: string, studentName: string, portalType: PortalType, defaultEmail?: string | null) => {
    setGenerateModal({
      open: true,
      studentId,
      studentName,
      portalType,
      targetEmail: defaultEmail || "",
    });
  };

  const submitGenerate = () => {
    startTransition(async () => {
      const res = await generatePortalLinkAction(
        generateModal.studentId,
        generateModal.portalType,
        generateModal.targetEmail,
      );

      setGenerateModal((prev) => ({ ...prev, open: false }));

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      setResultModal({
        open: true,
        title: `${generateModal.studentName} · ${generateModal.portalType === "parent" ? "Parent" : "Student"} Portal`,
        studentName: generateModal.studentName,
        portalType: generateModal.portalType,
        url: res.data.url,
        expiresAt: res.data.expiresAt,
      });

      toast.success(
        res.data.isRegenerated
          ? "Portal link regenerated! Previous link revoked."
          : "Portal access link generated successfully!",
      );
      router.refresh();
    });
  };

  const handleQuickCopy = (studentId: string, portalType: PortalType, targetEmail?: string | null) => {
    startTransition(async () => {
      const res = await generatePortalLinkAction(studentId, portalType, targetEmail);
      if (!res.success) {
        toast.error(res.message);
        return;
      }

      try {
        await navigator.clipboard.writeText(res.data.url);
        setCopiedId(`${studentId}-${portalType}`);
        toast.success(`✓ ${portalType === "parent" ? "Parent" : "Student"} portal link copied!`);
        setTimeout(() => setCopiedId(null), 2000);
      } catch {
        toast.error("Could not copy to clipboard");
      }
      router.refresh();
    });
  };

  const handleShareWhatsApp = (studentName: string, portalType: PortalType, studentId: string, defaultEmail?: string | null) => {
    startTransition(async () => {
      const res = await generatePortalLinkAction(studentId, portalType, defaultEmail);
      if (!res.success) {
        toast.error(res.message);
        return;
      }

      const text =
        portalType === "parent"
          ? `Hello! Here is your secure TuitionTrack Parent Portal link for ${studentName} to view homework, attendance, fees, marks, and progress: ${res.data.url}`
          : `Hello ${studentName}! Here is your TuitionTrack Student Portal link for assignments, tests, 3D lessons, and AI tutor: ${res.data.url}`;

      const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(waUrl, "_blank");
    });
  };

  const handleShowQr = (studentName: string, portalType: PortalType, studentId: string, defaultEmail?: string | null) => {
    startTransition(async () => {
      const res = await generatePortalLinkAction(studentId, portalType, defaultEmail);
      if (!res.success) {
        toast.error(res.message);
        return;
      }

      setQrModal({
        open: true,
        title: `${studentName} · ${portalType === "parent" ? "Parent" : "Student"} Portal`,
        subtitle: `Scan to open ${portalType === "parent" ? "Parent" : "Student"} Portal`,
        url: res.data.url,
      });
    });
  };

  const handleRevoke = (grantId: string, studentName: string, portalType: PortalType) => {
    if (!confirm(`Are you sure you want to revoke ${portalType} portal access for ${studentName}?`)) {
      return;
    }

    startTransition(async () => {
      const res = await revokePortalAccessAction(grantId);
      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(`${portalType === "parent" ? "Parent" : "Student"} portal access revoked.`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Primary Overview Cards */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Parent Portal Card */}
        <Card className="relative overflow-hidden border-sky-200/80 bg-gradient-to-br from-white via-sky-50/40 to-sky-100/30 shadow-soft">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-700">
                  <HeartHandshakeIcon className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">👨👩👧 Parent Portal</CardTitle>
                  <CardDescription className="text-xs">
                    Academic progress, homework, attendance, fees, marks, and announcements.
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="border-sky-300 bg-sky-100/50 text-sky-800">
                {stats.parentsActive} Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-sky-200/60 bg-white/80 p-3 text-xs">
              <span className="text-slate-600">Active families: <strong className="text-slate-900">{stats.parentsActive}</strong></span>
              <span className="text-slate-600">Pending activation: <strong className="text-amber-700">{stats.parentsPending}</strong></span>
              <span className="text-slate-600">Total students: <strong className="text-slate-900">{stats.totalStudents}</strong></span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Parents log in with their existing Google or Email account. Each link securely resolves to their child with zero password hassle.
            </p>
          </CardContent>
        </Card>

        {/* Student Portal Card */}
        <Card className="relative overflow-hidden border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/40 to-emerald-100/30 shadow-soft">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
                  <GraduationCapIcon className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">🎓 Student Portal</CardTitle>
                  <CardDescription className="text-xs">
                    Assignments, NCERT 3D video lessons, tests, marks, and 24/7 AI tutor.
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="border-emerald-300 bg-emerald-100/50 text-emerald-800">
                {stats.studentsActive} Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-emerald-200/60 bg-white/80 p-3 text-xs">
              <span className="text-slate-600">Active students: <strong className="text-slate-900">{stats.studentsActive}</strong></span>
              <span className="text-slate-600">Pending activation: <strong className="text-amber-700">{stats.studentsPending}</strong></span>
              <span className="text-slate-600">Total enrolled: <strong className="text-slate-900">{stats.totalStudents}</strong></span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Students access their personalized learning dashboard, homework drills, and interactive NCERT lessons using the same single-auth mechanism.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Control Center Table Card */}
      <Card className="border-white/90 bg-white/85 shadow-soft">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Portal Access Roster</CardTitle>
              <CardDescription className="text-xs">
                Manage, copy, regenerate, or revoke portal links for parents and students.
              </CardDescription>
            </div>

            {/* Search */}
            <div className="relative min-w-[260px]">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-sm"
                placeholder="Search student or email..."
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3">
            {(
              [
                { id: "all", label: `All (${portalRows.length})` },
                { id: "parent", label: `Parent Portal (${portalRows.filter((r) => r.portalType === "parent").length})` },
                { id: "student", label: `Student Portal (${portalRows.filter((r) => r.portalType === "student").length})` },
                { id: "active", label: `Active (${portalRows.filter((r) => r.status === "active").length})` },
                { id: "pending", label: `Pending (${portalRows.filter((r) => r.status === "pending").length})` },
                { id: "revoked", label: `Revoked (${portalRows.filter((r) => r.status === "revoked").length})` },
              ] as { id: FilterType; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === t.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Portal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Target Account</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-sm text-slate-500">
                      No portal access records match the selected filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => {
                    const isParent = row.portalType === "parent";
                    const isCopied = copiedId === `${row.studentId}-${row.portalType}`;
                    const defaultEmail = isParent ? row.parentEmail : row.studentEmail;

                    return (
                      <TableRow key={row.key} className="hover:bg-slate-50/60">
                        {/* Student info */}
                        <TableCell>
                          <Link
                            href={`/app/students/${row.studentId}`}
                            className="font-medium text-slate-900 hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            <span>{row.studentName}</span>
                            <span className="text-xs text-slate-400">({row.studentClass})</span>
                          </Link>
                        </TableCell>

                        {/* Portal type */}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              isParent
                                ? "border-sky-300 bg-sky-50 text-sky-700 gap-1 font-medium"
                                : "border-emerald-300 bg-emerald-50 text-emerald-700 gap-1 font-medium"
                            }
                          >
                            {isParent ? (
                              <HeartHandshakeIcon className="size-3" />
                            ) : (
                              <GraduationCapIcon className="size-3" />
                            )}
                            {isParent ? "Parent Portal" : "Student Portal"}
                          </Badge>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {row.status === "active" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active
                            </span>
                          ) : row.status === "pending" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                              <span className="size-1.5 rounded-full bg-amber-500" />
                              Pending
                            </span>
                          ) : row.status === "revoked" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                              <span className="size-1.5 rounded-full bg-rose-500" />
                              Revoked
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                              Not Generated
                            </span>
                          )}
                        </TableCell>

                        {/* Target email */}
                        <TableCell className="text-xs text-slate-500">
                          {row.targetEmail || defaultEmail || "Any verified login"}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {row.status === "not_generated" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/5"
                                disabled={isPending}
                                onClick={() =>
                                  handleGenerate(
                                    row.studentId,
                                    row.studentName,
                                    row.portalType,
                                    defaultEmail,
                                  )
                                }
                              >
                                <PlusIcon className="size-3" />
                                Generate Link
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2.5 text-xs gap-1"
                                  title="Copy portal link"
                                  disabled={isPending}
                                  onClick={() =>
                                    handleQuickCopy(row.studentId, row.portalType, defaultEmail)
                                  }
                                >
                                  {isCopied ? (
                                    <CheckIcon className="size-3 text-emerald-600" />
                                  ) : (
                                    <CopyIcon className="size-3" />
                                  )}
                                  {isCopied ? "Copied" : "Copy"}
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="size-7 text-emerald-600 hover:bg-emerald-50"
                                  title="Share via WhatsApp"
                                  disabled={isPending}
                                  onClick={() =>
                                    handleShareWhatsApp(
                                      row.studentName,
                                      row.portalType,
                                      row.studentId,
                                      defaultEmail,
                                    )
                                  }
                                >
                                  <Share2Icon className="size-3.5" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="size-7 text-slate-600 hover:bg-slate-100"
                                  title="Generate QR Code"
                                  disabled={isPending}
                                  onClick={() =>
                                    handleShowQr(
                                      row.studentName,
                                      row.portalType,
                                      row.studentId,
                                      defaultEmail,
                                    )
                                  }
                                >
                                  <QrCodeIcon className="size-3.5" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="size-7 text-slate-500 hover:bg-slate-100"
                                  title="Regenerate link (revokes previous)"
                                  disabled={isPending}
                                  onClick={() =>
                                    handleGenerate(
                                      row.studentId,
                                      row.studentName,
                                      row.portalType,
                                      defaultEmail,
                                    )
                                  }
                                >
                                  <RotateCwIcon className="size-3.5" />
                                </Button>

                                {row.status !== "revoked" && row.grantId ? (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="size-7 text-rose-500 hover:bg-rose-50"
                                    title="Revoke access"
                                    disabled={isPending}
                                    onClick={() =>
                                      handleRevoke(row.grantId!, row.studentName, row.portalType)
                                    }
                                  >
                                    <BanIcon className="size-3.5" />
                                  </Button>
                                ) : null}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Generation Dialog */}
      <Dialog
        open={generateModal.open}
        onOpenChange={(open) => setGenerateModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {generateModal.portalType === "parent" ? "Generate Parent Portal Link" : "Generate Student Portal Link"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Create an opaque, secure access token for {generateModal.studentName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Optional Target Email Binding
              </label>
              <Input
                type="email"
                value={generateModal.targetEmail}
                onChange={(e) =>
                  setGenerateModal((prev) => ({ ...prev, targetEmail: e.target.value }))
                }
                placeholder="parent@example.com (leave blank for any verified account)"
                className="text-sm"
              />
              <p className="text-[11px] text-slate-400">
                If specified, only an account authenticated with this exact email can claim the link.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGenerateModal((prev) => ({ ...prev, open: false }))}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={submitGenerate} disabled={isPending}>
              {isPending ? "Generating..." : "Generate & Copy Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generated Result Modal */}
      <Dialog
        open={resultModal.open}
        onOpenChange={(open) => setResultModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SparklesIcon className="size-4 text-primary" />
              <span>Portal Link Ready</span>
            </DialogTitle>
            <DialogDescription className="text-xs">{resultModal.title}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="break-all font-mono text-xs text-slate-800">{resultModal.url}</p>
            </div>
            <p className="text-[11px] text-slate-500">
              Share this link directly with the {resultModal.portalType}. When opened, they authenticate with their existing Google or Email account to activate their portal.
            </p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={async () => {
                await navigator.clipboard.writeText(resultModal.url);
                toast.success("Copied to clipboard!");
              }}
            >
              <CopyIcon className="size-3.5" />
              Copy Link
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                const text =
                  resultModal.portalType === "parent"
                    ? `Hello! Here is your secure TuitionTrack Parent Portal link for ${resultModal.studentName}: ${resultModal.url}`
                    : `Hello ${resultModal.studentName}! Here is your TuitionTrack Student Portal link: ${resultModal.url}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
              }}
            >
              <Share2Icon className="size-3.5" />
              Share on WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Modal */}
      <PortalQrDialog
        open={qrModal.open}
        onOpenChange={(open) => setQrModal((prev) => ({ ...prev, open }))}
        title={qrModal.title}
        subtitle={qrModal.subtitle}
        url={qrModal.url}
      />
    </div>
  );
}

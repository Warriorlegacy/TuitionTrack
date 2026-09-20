"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BanIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  GraduationCapIcon,
  HeartHandshakeIcon,
  QrCodeIcon,
  RotateCwIcon,
  Share2Icon,
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
import { PortalQrDialog } from "@/components/shared/portal-qr-dialog";
import {
  generatePortalLinkAction,
  revokePortalAccessAction,
} from "@/actions/portal-access";
import type { StudentPortalStatus, PortalType } from "@/lib/portal-access/types";

export function StudentPortalAccessCard({
  status,
}: {
  status: StudentPortalStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [qrModal, setQrModal] = useState<{
    open: boolean;
    title: string;
    subtitle: string;
    url: string;
  }>({ open: false, title: "", subtitle: "", url: "" });

  const handleCopyLink = (portalType: PortalType, defaultEmail?: string | null) => {
    startTransition(async () => {
      const res = await generatePortalLinkAction(status.studentId, portalType, defaultEmail);
      if (!res.success) {
        toast.error(res.message);
        return;
      }

      try {
        await navigator.clipboard.writeText(res.data.url);
        setCopiedKey(portalType);
        toast.success(`✓ ${portalType === "parent" ? "Parent" : "Student"} portal link copied!`);
        setTimeout(() => setCopiedKey(null), 2000);
      } catch {
        toast.error("Could not copy link");
      }
      router.refresh();
    });
  };

  const handleWhatsApp = (portalType: PortalType, defaultEmail?: string | null) => {
    startTransition(async () => {
      const res = await generatePortalLinkAction(status.studentId, portalType, defaultEmail);
      if (!res.success) {
        toast.error(res.message);
        return;
      }

      const text =
        portalType === "parent"
          ? `Hello! Here is your secure TuitionTrack Parent Portal link for ${status.studentName}: ${res.data.url}`
          : `Hello ${status.studentName}! Here is your TuitionTrack Student Portal link: ${res.data.url}`;

      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    });
  };

  const handleShowQr = (portalType: PortalType, defaultEmail?: string | null) => {
    startTransition(async () => {
      const res = await generatePortalLinkAction(status.studentId, portalType, defaultEmail);
      if (!res.success) {
        toast.error(res.message);
        return;
      }

      setQrModal({
        open: true,
        title: `${status.studentName} · ${portalType === "parent" ? "Parent" : "Student"} Portal`,
        subtitle: `Scan to open ${portalType === "parent" ? "Parent" : "Student"} Portal`,
        url: res.data.url,
      });
    });
  };

  const handleRevoke = (grantId: string, portalType: PortalType) => {
    if (!confirm(`Are you sure you want to revoke ${portalType} portal access for ${status.studentName}?`)) {
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

  const portals: {
    type: PortalType;
    label: string;
    icon: typeof HeartHandshakeIcon;
    grant: typeof status.parentGrant;
    defaultEmail?: string | null;
    desc: string;
    previewUrl: string;
  }[] = [
    {
      type: "parent",
      label: "Parent Portal",
      icon: HeartHandshakeIcon,
      grant: status.parentGrant,
      defaultEmail: status.parentEmail,
      desc: "Grants access to child homework, attendance, fees, marks, and progress.",
      previewUrl: `/parent?child=${status.studentId}`,
    },
    {
      type: "student",
      label: "Student Portal",
      icon: GraduationCapIcon,
      grant: status.studentGrant,
      defaultEmail: status.studentEmail,
      desc: "Grants access to assignments, tests, 3D video lessons, and 24/7 AI tutor.",
      previewUrl: `/student/dashboard`,
    },
  ];

  return (
    <Card className="border-white/90 bg-white/85 shadow-soft">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">PORTAL ACCESS</CardTitle>
          <span className="text-xs text-slate-400">Independent Single-Auth Grants</span>
        </div>
        <CardDescription className="text-xs">
          Generate, copy, regenerate or revoke opaque portal access links for {status.studentName}.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {portals.map((p) => {
            const Icon = p.icon;
            const isCopied = copiedKey === p.type;
            const statusLabel = p.grant?.status ?? "not_generated";

            return (
              <div
                key={p.type}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-xl bg-white shadow-xs text-primary">
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{p.label}</p>
                      <p className="text-[11px] text-slate-400">{p.defaultEmail || "No target email bound"}</p>
                    </div>
                  </div>

                  {statusLabel === "active" ? (
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 gap-1 text-[11px]">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </Badge>
                  ) : statusLabel === "pending" ? (
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 gap-1 text-[11px]">
                      <span className="size-1.5 rounded-full bg-amber-500" />
                      Pending
                    </Badge>
                  ) : statusLabel === "revoked" ? (
                    <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-700 gap-1 text-[11px]">
                      <span className="size-1.5 rounded-full bg-rose-500" />
                      Revoked
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-400 text-[11px]">
                      Not Generated
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-slate-500">{p.desc}</p>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-medium"
                    disabled={isPending}
                    onClick={() => handleCopyLink(p.type, p.defaultEmail)}
                  >
                    {isCopied ? (
                      <CheckIcon className="size-3.5 text-emerald-600" />
                    ) : (
                      <CopyIcon className="size-3.5" />
                    )}
                    {isCopied ? "Link Copied" : "Copy Link"}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    disabled={isPending}
                    onClick={() => handleWhatsApp(p.type, p.defaultEmail)}
                    title="Share via WhatsApp"
                  >
                    <Share2Icon className="size-3.5" />
                    WhatsApp
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    disabled={isPending}
                    onClick={() => handleShowQr(p.type, p.defaultEmail)}
                    title="QR Code"
                  >
                    <QrCodeIcon className="size-3.5" />
                    QR
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-primary"
                    onClick={() => window.open(p.previewUrl, "_blank")}
                    title={`Open ${p.label}`}
                  >
                    <ExternalLinkIcon className="size-3.5" />
                    Open
                  </Button>

                  {p.grant && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-xs text-slate-500 hover:text-slate-700"
                      disabled={isPending}
                      onClick={() => handleCopyLink(p.type, p.defaultEmail)}
                      title="Regenerate link (revokes previous)"
                    >
                      <RotateCwIcon className="size-3.5" />
                      Regenerate
                    </Button>
                  )}

                  {p.grant && p.grant.status !== "revoked" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                      disabled={isPending}
                      onClick={() => handleRevoke(p.grant!.id, p.type)}
                      title="Revoke access"
                    >
                      <BanIcon className="size-3.5" />
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      <PortalQrDialog
        open={qrModal.open}
        onOpenChange={(open) => setQrModal((prev) => ({ ...prev, open }))}
        title={qrModal.title}
        subtitle={qrModal.subtitle}
        url={qrModal.url}
      />
    </Card>
  );
}

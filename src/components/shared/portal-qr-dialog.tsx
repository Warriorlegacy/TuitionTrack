"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CopyIcon, CheckIcon, DownloadIcon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function PortalQrDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  url,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  url: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (url && open) {
      QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: {
          dark: "#090d16",
          light: "#ffffff",
        },
      })
        .then((dataUrl) => setQrDataUrl(dataUrl))
        .catch(() => setQrDataUrl(""));
    }
  }, [url, open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Portal link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${title.toLowerCase().replace(/\s+/g, "-")}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center text-xs text-slate-500">
            {subtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-2">
          {qrDataUrl ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Portal QR Code" className="size-56 rounded-lg" />
            </div>
          ) : (
            <div className="flex size-56 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
              Generating QR...
            </div>
          )}

          <p className="mt-3 text-[11px] text-slate-400">
            Scan with phone camera or WhatsApp. No personal child data is encoded in the QR.
          </p>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-xs"
              onClick={handleCopy}
            >
              {copied ? <CheckIcon className="size-3.5 text-emerald-600" /> : <CopyIcon className="size-3.5" />}
              {copied ? "Copied" : "Copy Link"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleDownload}
              disabled={!qrDataUrl}
            >
              <DownloadIcon className="size-3.5" />
              Save Image
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-1.5 text-xs text-primary"
            onClick={() => window.open(url, "_blank")}
          >
            <ExternalLinkIcon className="size-3.5" />
            Open Link in New Tab
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

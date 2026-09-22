"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LinkIcon, CheckIcon, Share2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Direct student link for one AI assignment. The player resolves the
 * per-student question variant from the login, so one link serves every
 * targeted student — the teacher just copies or forwards it on WhatsApp.
 */
export function AssignmentShareButtons({
  assignmentId,
  title,
}: {
  assignmentId: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);

  const studentUrl = () =>
    `${window.location.origin}/student/homework/${assignmentId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(studentUrl());
      setCopied(true);
      toast.success("Student link copied — send it to the targeted students.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link.");
    }
  };

  const handleWhatsApp = () => {
    const text = `Hello! New homework assigned: ${title}\nOpen your link to start: ${studentUrl()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="px-2.5"
        title="Copy direct student link"
      >
        {copied ? <CheckIcon className="h-4 w-4 text-emerald-600" /> : <LinkIcon className="h-4 w-4" />}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleWhatsApp}
        className="px-2.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
        title="Send link via WhatsApp"
      >
        <Share2Icon className="h-4 w-4" />
      </Button>
    </>
  );
}

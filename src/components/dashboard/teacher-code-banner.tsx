"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CopyIcon,
  CheckIcon,
  KeyRoundIcon,
  UserPlusIcon,
  BookOpenCheckIcon,
  SparklesIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { TeacherAddMemberByCodeDialog } from "@/components/workspace/teacher-add-by-code-dialog";

interface TeacherCodeBannerProps {
  workspaceCode: string;
  workspaceName?: string;
  teacherName?: string;
}

export function TeacherCodeBanner({
  workspaceCode,
  workspaceName = "TuitionTrack Workspace",
  teacherName,
}: TeacherCodeBannerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!workspaceCode) return;
    try {
      await navigator.clipboard.writeText(workspaceCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-soft">
      {/* Subtle background glow */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 size-64 rounded-full bg-primary/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 -left-12 size-64 rounded-full bg-indigo-500/15 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Greeting and Workspace Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-0.5 text-xs font-semibold text-primary-foreground border border-primary/30">
              <SparklesIcon className="size-3 text-amber-300" />
              Teacher Workspace Command Center
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {workspaceName}
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {teacherName ? `Welcome back, ${teacherName}` : "Tuition Operations Dashboard"}
          </h1>
          <p className="max-w-xl text-xs text-slate-300 leading-relaxed">
            Everything is accessible right here on this single dashboard. Manage assignments, 3D lessons, attendance, tests, tuition fees, and connect students or parents via universal verification codes.
          </p>
        </div>

        {/* Right: Prominent Workspace Code Card & Quick Actions */}
        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-3">
          {/* Universal Workspace Code Box */}
          <div className="flex flex-col justify-center rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-slate-300">
              <span className="flex items-center gap-1.5">
                <KeyRoundIcon className="size-3.5 text-amber-300" />
                Workspace Join Code:
              </span>
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">
                Shareable
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="font-mono text-xl font-extrabold tracking-wider text-white">
                {workspaceCode || "TT-PENDING"}
              </span>

              <button
                type="button"
                onClick={handleCopy}
                disabled={!workspaceCode}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25 active:scale-95 disabled:opacity-50"
              >
                {copied ? (
                  <>
                    <CheckIcon className="size-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <CopyIcon className="size-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              Give this code to students or parents to enter this workspace.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <TeacherAddMemberByCodeDialog />

            <div className="flex gap-2">
              <Link
                href="/app/homework"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className:
                    "h-9 flex-1 gap-1.5 border-white/20 bg-white/5 text-xs font-medium text-white hover:bg-white/15",
                })}
              >
                <BookOpenCheckIcon className="size-3.5 text-primary" />
                Assign HW
              </Link>
              <Link
                href="/app/students"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className:
                    "h-9 flex-1 gap-1.5 border-white/20 bg-white/5 text-xs font-medium text-white hover:bg-white/15",
                })}
              >
                <UserPlusIcon className="size-3.5 text-emerald-400" />
                Students
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

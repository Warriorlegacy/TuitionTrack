"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  GraduationCapIcon,
  HeartHandshakeIcon,
  LogOutIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { redeemPortalGrantAction } from "@/actions/portal-access";
import { signOutAction } from "@/actions/portal";
import type { PortalType } from "@/lib/portal-access/types";

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
        fill="#EA4335"
      />
      <path d="M1 1h22v22H1z" fill="none" />
    </svg>
  );
}

export function PortalActivationCard({
  token,
  portalType,
  studentName,
  studentClass,
  targetEmail,
  signedInEmail,
  isSignedIn,
  currentPath,
}: {
  token: string;
  portalType: PortalType;
  studentName: string;
  studentClass: string;
  targetEmail?: string | null;
  signedInEmail?: string | null;
  isSignedIn: boolean;
  currentPath: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [googlePending, setGooglePending] = useState(false);
  const isParent = portalType === "parent";

  const isEmailMismatch =
    isSignedIn &&
    targetEmail &&
    signedInEmail &&
    targetEmail.trim().toLowerCase() !== signedInEmail.trim().toLowerCase();

  // Auto-activate when authenticated and matching email
  useEffect(() => {
    if (isSignedIn && !isEmailMismatch) {
      startTransition(async () => {
        const res = await redeemPortalGrantAction(token);
        if (res.success && res.data.redirectUrl) {
          toast.success(`Access confirmed! Redirecting to ${isParent ? "Parent" : "Student"} Portal...`);
          router.replace(res.data.redirectUrl);
        }
      });
    }
  }, [isSignedIn, isEmailMismatch, token, isParent, router]);

  const handleManualRedeem = () => {
    startTransition(async () => {
      const res = await redeemPortalGrantAction(token);
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success("Portal access activated!");
      router.replace(res.data.redirectUrl);
    });
  };

  const handleGoogleSignIn = () => {
    if (googlePending) return;
    setGooglePending(true);
    toast.loading("Connecting with Google...", { id: "google-auth" });

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(currentPath)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        setGooglePending(false);
        toast.dismiss("google-auth");
        toast.error(error.message);
      }
    });
  };

  return (
    <Card className="w-full max-w-md border-white/90 bg-white/95 shadow-xl backdrop-blur-lg">
      <CardHeader className="text-center space-y-3 pb-4">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-xs">
          {isParent ? (
            <HeartHandshakeIcon className="size-7" />
          ) : (
            <GraduationCapIcon className="size-7" />
          )}
        </div>

        <div>
          <Badge
            variant="outline"
            className={
              isParent
                ? "border-sky-300 bg-sky-50 text-sky-700 font-semibold"
                : "border-emerald-300 bg-emerald-50 text-emerald-700 font-semibold"
            }
          >
            {isParent ? "Parent Portal Invitation" : "Student Portal Invitation"}
          </Badge>
          <CardTitle className="mt-2 text-xl font-bold text-slate-950">
            Welcome to TuitionTrack
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            You have been invited to access the learning portal for:
          </CardDescription>
        </div>

        {/* Student Highlight Box */}
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 text-center space-y-0.5">
          <p className="text-sm font-semibold text-slate-900">{studentName}</p>
          <p className="text-xs text-slate-500">Class {studentClass} · Academic Portal</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Value Proposition */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs text-slate-600 space-y-2">
          <div className="flex items-start gap-2">
            <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600 mt-0.5" />
            <span>
              {isParent
                ? "View completed homework, live attendance, test performance, and verified fee receipts."
                : "Work on homework assignments, practice tests, 3D NCERT lessons, and AI doubt clearing."}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <ShieldCheckIcon className="size-4 shrink-0 text-primary mt-0.5" />
            <span>One account for all portals: log in once with your personal Google or Email.</span>
          </div>
        </div>

        {/* Auth State & Call to Actions */}
        {!isSignedIn ? (
          <div className="space-y-3">
            <div className="text-center space-y-1">
              <p className="text-xs font-semibold text-slate-800">
                Sign in to activate your access
              </p>
              <p className="text-[11px] text-slate-400">
                {targetEmail
                  ? `This link is reserved for ${targetEmail}`
                  : "Sign in with your Google account or email"}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full font-medium h-11 border-slate-200 shadow-xs"
              onClick={handleGoogleSignIn}
              disabled={googlePending || isPending}
            >
              <GoogleIcon />
              {googlePending ? "Connecting to Google..." : "Continue with Google"}
            </Button>

            <Link
              href={`/login?next=${encodeURIComponent(currentPath)}`}
              className={buttonVariants({
                variant: "default",
                size: "lg",
                className: "w-full font-medium h-11 bg-slate-950 hover:bg-slate-800 text-white",
              })}
            >
              Continue with Email & Password
            </Link>
          </div>
        ) : isEmailMismatch ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-800 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircleIcon className="size-4 text-amber-600" />
                <span>Account Mismatch</span>
              </div>
              <p>
                This invitation is addressed to <strong>{targetEmail}</strong>, but you are currently signed in as <strong>{signedInEmail}</strong>.
              </p>
            </div>

            <form action={signOutAction}>
              <Button type="submit" variant="outline" className="w-full gap-2 text-xs">
                <LogOutIcon className="size-3.5" />
                Sign out and switch account
              </Button>
            </form>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-800 font-medium">
                <CheckCircle2Icon className="size-4 text-emerald-600" />
                <span>Signed in as {signedInEmail}</span>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full gap-2 font-semibold h-11 bg-primary hover:bg-primary/90 text-white shadow-soft"
              onClick={handleManualRedeem}
              disabled={isPending}
            >
              {isPending ? (
                <span>Activating Portal...</span>
              ) : (
                <>
                  <span>Enter {isParent ? "Parent" : "Student"} Portal</span>
                  <ArrowRightIcon className="size-4" />
                </>
              )}
            </Button>
          </div>
        )}

        <div className="pt-2 text-center">
          <p className="text-[11px] text-slate-400">
            Protected by TuitionTrack Cryptographic Access Control & RLS.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleReset = () => {
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast.error(error.message);
        return;
      }

      setIsSubmitted(true);
      toast.success("Password updated successfully.");
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="shell-gradient hidden rounded-[2rem] border border-white/70 p-10 shadow-soft lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-6">
            <Brand />
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold text-slate-950">
                Choose your new password.
              </h1>
              <p className="max-w-md text-base leading-7 text-slate-600">
                Set a secure password for your TuitionTrack account. Make sure
                it&apos;s at least 6 characters and something you&apos;ll remember.
              </p>
            </div>
          </div>
          <div className="rounded-3xl border border-white/80 bg-white/75 p-6 text-sm text-slate-600">
            Once your password is changed, you&apos;ll be able to log in
            immediately with your new credentials.
          </div>
        </section>

        <section className="flex flex-col justify-center gap-5">
          <Card className="border-white/90 bg-white/92 shadow-soft">
            <CardHeader className="space-y-3">
              <CardTitle className="text-2xl">Set new password</CardTitle>
              <CardDescription className="leading-6">
                Enter your new password below. After resetting, you&apos;ll be
                logged in and redirected to the dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isSubmitted ? (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Repeat your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button
                    className="h-11 shadow-sm"
                    disabled={isPending || !password || !confirmPassword}
                    onClick={handleReset}
                  >
                    {isPending ? (
                      <Loader2Icon className="mr-2 size-4 animate-spin" />
                    ) : null}
                    Update password
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6 py-4 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <ShieldCheckIcon className="size-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Password updated
                    </h3>
                    <p className="text-sm text-slate-600">
                      Your password has been changed successfully. You&apos;re
                      now logged in and can proceed to the dashboard.
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => router.push("/app/dashboard")}
                  >
                    Go to dashboard
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-sm text-slate-500">
            Remembered your password?{" "}
            <Link href="/login" className="font-medium text-primary">
              Log in instead
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

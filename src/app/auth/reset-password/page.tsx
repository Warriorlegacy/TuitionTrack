"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, KeyIcon, Loader2Icon, ShieldCheckIcon } from "lucide-react";
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
  const [isSuccess, setIsSuccess] = useState(false);

  const handleUpdatePassword = () => {
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setIsSuccess(true);
      toast.success("Password updated successfully.");
      
      // Delay redirect to show success state
      setTimeout(() => {
        router.push("/app/dashboard");
      }, 2000);
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
                Secure your workspace.
              </h1>
              <p className="max-w-md text-base leading-7 text-slate-600">
                You&apos;ve successfully verified your identity. Now, choose a strong new password 
                to protect your TuitionTrack account and data.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/75 p-4 text-sm text-slate-600">
              <ShieldCheckIcon className="size-5 text-primary" />
              <span>Passwords are encrypted and never stored in plain text.</span>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/75 p-6 text-xs text-slate-500 italic">
              &quot;Security is not a product, but a process.&quot; — Bruce Schneier
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-center">
          <Card className="border-white/90 bg-white/92 shadow-soft">
            <CardHeader className="space-y-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <KeyIcon className="size-5" />
              </div>
              <CardTitle className="text-2xl">Confirm New Password</CardTitle>
              <CardDescription className="leading-6">
                Please enter a new password for your account. Make sure it&apos;s something secure that you haven&apos;t used before.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isSuccess ? (
                <div className="flex flex-col gap-6">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="password">New password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="confirm-password">Confirm new password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="Repeat your new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <Button 
                    className="h-11 shadow-sm" 
                    disabled={isPending || !password || !confirmPassword}
                    onClick={handleUpdatePassword}
                  >
                    {isPending ? <Loader2Icon className="size-4 animate-spin mr-2" /> : null}
                    Update Password
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6 py-8 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2Icon className="size-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-slate-900">Success!</h3>
                    <p className="text-sm text-slate-600">
                      Your password has been reset successfully. Redirecting you to your dashboard...
                    </p>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-emerald-500 animate-progress origin-left" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

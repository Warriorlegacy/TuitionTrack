"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeftIcon, Loader2Icon, MailIcon } from "lucide-react";
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

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleResetRequest = () => {
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      
      const redirectTo = `${window.location.origin}/auth/callback?next=/auth/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setIsSubmitted(true);
      toast.success("Reset link sent to your email.");
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
                Recover your account access.
              </h1>
              <p className="max-w-md text-base leading-7 text-slate-600">
                Forget your password? No problem. Enter your email and we&apos;ll send you a secure 
                link to reset your password and get you back into TuitionTrack.
              </p>
            </div>
          </div>
          <div className="rounded-3xl border border-white/80 bg-white/75 p-6 text-sm text-slate-600">
            If you signed up using Google, you can log in directly using your Google account without 
            needing a separate password.
          </div>
        </section>

        <section className="flex flex-col justify-center gap-5">
          <Card className="border-white/90 bg-white/92 shadow-soft">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-2">
                <Link 
                  href="/login" 
                  className="group flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary"
                >
                  <ArrowLeftIcon className="size-3 transition-transform group-hover:-translate-x-0.5" />
                  Back to login
                </Link>
              </div>
              <CardTitle className="text-2xl">Reset Password</CardTitle>
              <CardDescription className="leading-6">
                Enter your registered email address and we&apos;ll send you instructions to reset your password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isSubmitted ? (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    className="h-11 shadow-sm" 
                    disabled={isPending || !email}
                    onClick={handleResetRequest}
                  >
                    {isPending ? <Loader2Icon className="size-4 animate-spin mr-2" /> : null}
                    Send reset link
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6 py-4 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MailIcon className="size-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-slate-900">Check your inbox</h3>
                    <p className="text-sm text-slate-600">
                      We&apos;ve sent a password reset link to <span className="font-medium text-slate-900">{email}</span>. 
                      The link will expire in 1 hour.
                    </p>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => setIsSubmitted(false)}>
                    Didn&apos;t receive it? Try again
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

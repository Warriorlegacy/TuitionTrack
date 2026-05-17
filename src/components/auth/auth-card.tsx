"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/env";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type AuthCardProps = {
  mode: "login" | "signup";
};

export function AuthCard({ mode }: AuthCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"teacher" | "parent" | "student">("teacher");
  const configured = useMemo(() => isSupabaseConfigured(), []);

  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

  const handleEmailAuth = () => {
    startTransition(async () => {
      if (!configured) {
        toast.error("Add your Supabase environment variables to enable authentication.");
        return;
      }

      const supabase = createSupabaseBrowserClient();

      const result =
        mode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: redirectTo,
                data: {
                  name,
                  role,
                },
              },
            });

      if (result.error) {
        toast.error(result.error.message);
        return;
      }

      if (mode === "signup" && !result.data.session) {
        toast.success("Account created. Check your email to confirm your signup.");
        router.push("/login");
        return;
      }

      toast.success(
        mode === "login"
          ? "Welcome back."
          : `${role.charAt(0).toUpperCase() + role.slice(1)} account created.`,
      );
      router.push(
        mode === "login"
          ? "/app/dashboard"
          : role === "teacher"
            ? "/auth/onboarding"
            : "/app/dashboard",
      );
      router.refresh();
    });
  };

  const handleGoogleAuth = () => {
    startTransition(async () => {
      if (!configured) {
        toast.error("Add your Supabase environment variables to enable Google login.");
        return;
      }

      const supabase = createSupabaseBrowserClient();
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
        toast.error(error.message);
      }
    });
  };

  return (
    <Card className="border-white/90 bg-white/92 shadow-soft">
      <CardHeader className="space-y-3">
        <CardTitle className="text-2xl">
          {mode === "login" ? "Login to TuitionTrack" : "Create your account"}
        </CardTitle>
        <CardDescription className="leading-6">
          {mode === "login"
            ? "Access your dashboard, parent portal views, and live class operations."
            : "Join as a teacher to manage classes, or as a parent/student to track progress."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {mode === "signup" && (
          <div className="flex flex-col gap-4 pb-2">
            <div className="flex flex-col gap-2">
              <Label>I am a...</Label>
              <Tabs
                value={role}
                onValueChange={(v) => setRole(v as typeof role)}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="teacher">Teacher</TabsTrigger>
                  <TabsTrigger value="parent">Parent</TabsTrigger>
                  <TabsTrigger value="student">Student</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                placeholder={role === "teacher" ? "Aarav Mehta" : "Parent Name"}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder={role === "teacher" ? "teacher@example.com" : "parent@example.com"}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {mode === "login" && (
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary hover:underline"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Minimum 6 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <Button
          className="h-11 shadow-sm"
          disabled={isPending || !email || !password || (mode === "signup" && !name)}
          onClick={handleEmailAuth}
        >
          {isPending ? <Loader2Icon className="size-4 animate-spin mr-2" /> : null}
          {mode === "login" ? "Login with email" : "Create account"}
        </Button>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white/92 px-2 text-slate-500">Or continue with</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="h-11 border-slate-200 bg-white shadow-sm transition-all hover:bg-slate-50"
          disabled={isPending}
          onClick={handleGoogleAuth}
        >
          <GoogleIcon />
          Google
        </Button>

        {!configured && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700">
            Supabase keys not detected in production. Check Vercel settings.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

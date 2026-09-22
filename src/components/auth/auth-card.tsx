"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2Icon,
  GraduationCapIcon,
  UsersIcon,
  BriefcaseIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  ShieldCheckIcon,
} from "lucide-react";
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
import { validateWorkspaceCodeAction, joinWorkspaceAction } from "@/actions/workspace-actions";

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

type SelectedRole = "teacher" | "student" | "parent";

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Email or password is incorrect. Try again or reset your password.";
  }
  if (m.includes("email not confirmed")) {
    return "Please verify your email first — check your inbox for the confirmation link.";
  }
  if (m.includes("user already registered") || m.includes("already exists")) {
    return "This email already has an account. Try logging in instead.";
  }
  if (m.includes("password should be at least")) {
    return "Password must be at least 6 characters.";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (m.includes("network") || m.includes("fetch failed") || m.includes("failed to fetch")) {
    return "Network issue — check your connection and try again.";
  }
  if (m.includes("provider is not enabled")) {
    return "Google login isn't enabled yet. Use email login for now.";
  }
  return message;
}

export function AuthCard({ mode: initialMode }: AuthCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [googlePending, setGooglePending] = useState(false);

  const initialRoleParam = searchParams.get("role") as SelectedRole | null;
  const initialCodeParam = searchParams.get("code") || "";

  // Step 1: 'select_role' | 'enter_code' | 'auth_form'
  const [step, setStep] = useState<"select_role" | "enter_code" | "auth_form">(
    initialRoleParam
      ? initialRoleParam === "teacher"
        ? "auth_form"
        : initialCodeParam
          ? "auth_form"
          : "enter_code"
      : "select_role"
  );

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [role, setRole] = useState<SelectedRole>(initialRoleParam || "teacher");
  const [workspaceCode, setWorkspaceCode] = useState(initialCodeParam);
  const [verifiedWorkspaceName, setVerifiedWorkspaceName] = useState("");
  const [codeValidating, setCodeValidating] = useState(false);
  const [codeError, setCodeError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const configured = useMemo(() => isSupabaseConfigured(), []);

  // Display toast error if redirected back with error query parameter
  useEffect(() => {
    const err = searchParams.get("error");
    if (err) {
      toast.error(friendlyAuthError(decodeURIComponent(err)));
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);
    }
  }, [searchParams]);

  // Handle Role Selection
  const handleSelectRole = (selected: SelectedRole) => {
    setRole(selected);
    if (selected === "teacher") {
      setStep("auth_form");
    } else {
      setStep("enter_code");
    }
  };

  // Validate Workspace Code
  const handleValidateCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!workspaceCode.trim()) {
      setCodeError("Please enter a workspace code.");
      return;
    }

    setCodeValidating(true);
    setCodeError("");

    const result = await validateWorkspaceCodeAction(workspaceCode);
    setCodeValidating(false);

    if (!result.valid) {
      setCodeError(result.error || "Workspace not found.");
      return;
    }

    setVerifiedWorkspaceName(result.workspaceName || "");
    if (result.workspaceCode) {
      setWorkspaceCode(result.workspaceCode);
    }
    toast.success(`Verified: ${result.workspaceName}`);
    setStep("auth_form");
  };

  const getDestinationUrl = () => {
    const nextParam = searchParams.get("next") || searchParams.get("returnTo");
    if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
      return nextParam;
    }
    if (role === "student") return "/student/dashboard";
    if (role === "parent") return "/parent/dashboard";
    return "/app/dashboard";
  };

  const safeNext = getDestinationUrl();

  const handleEmailAuth = () => {
    startTransition(async () => {
      if (!configured) {
        toast.error("Add your Supabase environment variables to enable authentication.");
        return;
      }

      const supabase = createSupabaseBrowserClient();

      const callbackQuery = new URLSearchParams({
        next: safeNext,
        signupRole: role,
      });
      if (workspaceCode) {
        callbackQuery.set("wsCode", workspaceCode);
      }

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?${callbackQuery.toString()}`
          : undefined;

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
                  workspace_code: workspaceCode,
                },
              },
            });

      if (result.error) {
        toast.error(friendlyAuthError(result.error.message));
        return;
      }

      if (mode === "signup" && !result.data.session) {
        toast.success("Account created! Check your email to confirm your signup.");
        setMode("login");
        return;
      }

      // If student or parent authenticated and has workspace code, join the workspace
      if (workspaceCode && (role === "student" || role === "parent")) {
        try {
          await joinWorkspaceAction({
            code: workspaceCode,
            role,
          });
        } catch (err) {
          console.error("Auto-join error:", err);
        }
      }

      toast.success(
        mode === "login"
          ? "Welcome back."
          : `${role.charAt(0).toUpperCase() + role.slice(1)} account created.`
      );

      router.push(safeNext);
      router.refresh();
    });
  };

  const handleGoogleAuth = () => {
    if (googlePending) return;
    setGooglePending(true);
    toast.loading("Opening Google sign-in…", { id: "google-auth" });

    startTransition(async () => {
      if (!configured) {
        setGooglePending(false);
        toast.dismiss("google-auth");
        toast.error("Add your Supabase environment variables to enable Google login.");
        return;
      }

      const callbackQuery = new URLSearchParams({
        next: safeNext,
        signupRole: role,
      });
      if (workspaceCode) {
        callbackQuery.set("wsCode", workspaceCode);
      }

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?${callbackQuery.toString()}`
          : undefined;

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
        setGooglePending(false);
        toast.dismiss("google-auth");
        toast.error(friendlyAuthError(error.message));
        return;
      }

      setTimeout(() => {
        setGooglePending(false);
        toast.dismiss("google-auth");
      }, 8000);
    });
  };

  // -------------------------------------------------------------------------
  // RENDER STEP 1: "How are you using TuitionTrack?"
  // -------------------------------------------------------------------------
  if (step === "select_role") {
    return (
      <Card className="border-white/90 bg-white/95 shadow-soft">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheckIcon className="size-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            How are you using TuitionTrack?
          </CardTitle>
          <CardDescription className="text-sm text-slate-600">
            Choose your role to enter the tailored classroom experience.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3.5 pt-2">
          {/* TEACHER CARD */}
          <button
            type="button"
            onClick={() => handleSelectRole("teacher")}
            className="group relative flex items-start gap-4 rounded-2xl border-2 border-slate-200/80 bg-white p-4.5 text-left transition-all hover:border-primary hover:bg-primary/[0.02] hover:shadow-md active:scale-[0.99]"
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-primary group-hover:text-white transition-colors">
              <BriefcaseIcon className="size-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900 group-hover:text-primary transition-colors">
                  👨‍🏫 Teacher
                </h3>
                <ArrowRightIcon className="size-4 text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Manage your classroom, students, homework, attendance, fees and progress reports.
              </p>
            </div>
          </button>

          {/* STUDENT CARD */}
          <button
            type="button"
            onClick={() => handleSelectRole("student")}
            className="group relative flex items-start gap-4 rounded-2xl border-2 border-slate-200/80 bg-white p-4.5 text-left transition-all hover:border-emerald-500 hover:bg-emerald-500/[0.02] hover:shadow-md active:scale-[0.99]"
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <GraduationCapIcon className="size-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                  🎓 Student
                </h3>
                <ArrowRightIcon className="size-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Access your classes, interactive homework, tests, results, and learning progress.
              </p>
            </div>
          </button>

          {/* PARENT / GUARDIAN CARD */}
          <button
            type="button"
            onClick={() => handleSelectRole("parent")}
            className="group relative flex items-start gap-4 rounded-2xl border-2 border-slate-200/80 bg-white p-4.5 text-left transition-all hover:border-indigo-500 hover:bg-indigo-500/[0.02] hover:shadow-md active:scale-[0.99]"
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <UsersIcon className="size-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                  👨‍👩‍👧 Parent / Guardian
                </h3>
                <ArrowRightIcon className="size-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Monitor your child&apos;s academic progress, homework completion, tests, and attendance.
              </p>
            </div>
          </button>
        </CardContent>
      </Card>
    );
  }

  // -------------------------------------------------------------------------
  // RENDER STEP 2: "Enter Teacher Workspace Code" (Student & Parent)
  // -------------------------------------------------------------------------
  if (step === "enter_code") {
    return (
      <Card className="border-white/90 bg-white/95 shadow-soft">
        <CardHeader className="space-y-2">
          <button
            type="button"
            onClick={() => setStep("select_role")}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeftIcon className="size-3.5" />
            <span>Change role</span>
          </button>
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            Enter Teacher Workspace Code
          </CardTitle>
          <CardDescription className="text-sm text-slate-600">
            Enter the 6-character code provided by your teacher to join their classroom (e.g.,{" "}
            <span className="font-mono font-medium text-primary">TT-6YEAEF</span>).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleValidateCode} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="workspace-code" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Teacher Workspace Code
              </Label>
              <Input
                id="workspace-code"
                placeholder="TT-XXXXXX"
                value={workspaceCode}
                onChange={(e) => {
                  setWorkspaceCode(e.target.value.toUpperCase());
                  setCodeError("");
                }}
                className="h-12 text-center font-mono text-lg tracking-widest uppercase font-bold"
                autoFocus
              />
              {codeError ? (
                <p className="text-xs font-medium text-destructive">{codeError}</p>
              ) : null}
            </div>

            <Button
              type="submit"
              className="h-11 font-semibold"
              disabled={codeValidating || !workspaceCode.trim()}
            >
              {codeValidating ? (
                <Loader2Icon className="size-4 animate-spin mr-2" />
              ) : (
                <ArrowRightIcon className="size-4 mr-2" />
              )}
              {codeValidating ? "Verifying workspace…" : "Continue"}
            </Button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setStep("auth_form")}
                className="text-xs text-slate-500 hover:text-primary hover:underline"
              >
                Already joined this workspace? Sign in directly
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  // -------------------------------------------------------------------------
  // RENDER STEP 3: Login or Signup Form
  // -------------------------------------------------------------------------
  const roleLabel =
    role === "teacher"
      ? "Teacher"
      : role === "student"
        ? "Student"
        : "Parent / Guardian";

  return (
    <Card className="border-white/90 bg-white/95 shadow-soft">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep(role === "teacher" ? "select_role" : "enter_code")}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeftIcon className="size-3.5" />
            <span>{role === "teacher" ? "Change role" : "Change workspace code"}</span>
          </button>

          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            {roleLabel}
          </span>
        </div>

        {verifiedWorkspaceName ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs font-medium text-emerald-800">
            <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" />
            <span className="truncate">
              Workspace: <strong>{verifiedWorkspaceName}</strong> ({workspaceCode})
            </span>
          </div>
        ) : null}

        <CardTitle className="text-2xl">
          {mode === "login" ? `Login as ${roleLabel}` : `Create ${roleLabel} Account`}
        </CardTitle>
        <CardDescription className="leading-6">
          {mode === "login"
            ? `Sign in to access your ${role === "teacher" ? "teaching operations" : "learning portal"}.`
            : role === "teacher"
              ? "Get your unique classroom workspace code and start managing students."
              : "Set up your credentials to join your teacher's workspace."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {mode === "signup" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              placeholder={role === "teacher" ? "Piyush Mehta" : role === "student" ? "Aarav Sharma" : "Rahul Sharma"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder={
              role === "teacher"
                ? "teacher@example.com"
                : role === "student"
                  ? "student@example.com"
                  : "parent@example.com"
            }
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Button
          className="h-11 shadow-sm font-semibold"
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
            <span className="bg-white/95 px-2 text-slate-500 font-medium">Or continue with</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="h-11 border-slate-200 bg-white shadow-sm transition-all hover:bg-slate-50 font-medium"
          disabled={isPending || googlePending}
          onClick={handleGoogleAuth}
        >
          {googlePending ? <Loader2Icon className="size-4 animate-spin mr-2" /> : <GoogleIcon />}
          {googlePending ? "Redirecting to Google…" : "Continue with Google"}
        </Button>

        <div className="pt-2 text-center text-xs text-slate-500">
          {mode === "login" ? (
            <p>
              Don&apos;t have an account yet?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="font-semibold text-primary hover:underline"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="font-semibold text-primary hover:underline"
              >
                Log in
              </button>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

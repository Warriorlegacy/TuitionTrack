"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpenCheckIcon,
  CalendarCheck2Icon,
  SparklesIcon,
  TrendingUpIcon,
  ArrowRightIcon,
  UserCheckIcon,
  GraduationCapIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { claimStudentInviteAction } from "@/actions/portal";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

type JoinPortalCardProps = {
  student: {
    id: string;
    name: string;
    class: string;
    teacher_name: string;
  };
  currentUser: {
    id: string;
    email: string;
    name: string | null;
    role: string | null;
  } | null;
};

export function JoinPortalCard({ student, currentUser }: JoinPortalCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<"student" | "parent">("student");
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleClaimExisting = (selectedRole: "student" | "parent") => {
    startTransition(async () => {
      const result = await claimStudentInviteAction(student.id, selectedRole);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.push("/app/dashboard");
      router.refresh();
    });
  };

  const handleGoogleAuth = async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const nextUrl = `/join?studentId=${student.id}&claimRole=${role}`;
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`;
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
      if (error) toast.error(error.message);
    } catch {
      toast.error("Failed to connect with Google.");
    }
  };

  const handleEmailAuth = () => {
    if (!email || !password) {
      toast.error("Please enter your email and password.");
      return;
    }
    if (authMode === "signup" && !name.trim()) {
      toast.error("Please enter your full name.");
      return;
    }

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/join?studentId=${student.id}&claimRole=${role}`;

      const res = authMode === "signup"
        ? await supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: {
              emailRedirectTo: redirectTo,
              data: {
                name: name.trim(),
                role: role,
              },
            },
          })
        : await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
          });

      if (res.error) {
        toast.error(res.error.message);
        return;
      }

      // Automatically claim student invite
      const claimResult = await claimStudentInviteAction(student.id, role);
      if (!claimResult.success) {
        toast.error(claimResult.message);
      } else {
        toast.success(claimResult.message);
      }

      router.push("/app/dashboard");
      router.refresh();
    });
  };

  return (
    <Card className="border-white/90 bg-white/95 shadow-xl backdrop-blur max-w-xl mx-auto overflow-hidden">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-primary to-indigo-600 px-6 py-5 text-white">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium tracking-wide uppercase opacity-90">
            TuitionTrack Portal Invite
          </span>
          <Badge className="bg-white/20 text-white hover:bg-white/30 border-0 text-[11px]">
            Class {student.class}
          </Badge>
        </div>
        <h2 className="text-2xl font-bold mt-1">
          Join {student.name}&apos;s Portal
        </h2>
        <p className="text-xs text-white/80 mt-0.5">
          Invited by Teacher {student.teacher_name}
        </p>
      </div>

      <CardContent className="p-6 space-y-6">
        {/* Features preview */}
        <div className="grid grid-cols-2 gap-3 py-1">
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-100 p-2.5 text-xs text-slate-700">
            <BookOpenCheckIcon className="size-4 text-primary shrink-0" />
            <span>Homework Tracking</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-100 p-2.5 text-xs text-slate-700">
            <CalendarCheck2Icon className="size-4 text-emerald-600 shrink-0" />
            <span>Daily Attendance</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-100 p-2.5 text-xs text-slate-700">
            <TrendingUpIcon className="size-4 text-indigo-600 shrink-0" />
            <span>Marks & Reports</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-100 p-2.5 text-xs text-slate-700">
            <SparklesIcon className="size-4 text-amber-500 shrink-0" />
            <span>24/7 AI Tutor</span>
          </div>
        </div>

        {/* If already logged in: One-click Connect */}
        {currentUser ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm shrink-0">
                <UserCheckIcon className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">
                  Signed in as {currentUser.email}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Connect your account to {student.name}&apos;s workspace to start viewing homework and reports.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-700">I am joining as:</Label>
              <Tabs value={role} onValueChange={(v) => setRole(v as "student" | "parent")} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="student">I am {student.name} (Student)</TabsTrigger>
                  <TabsTrigger value="parent">I am Parent</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <Button
              className="w-full h-11 text-sm font-semibold shadow-sm gap-2"
              onClick={() => handleClaimExisting(role)}
              disabled={isPending}
            >
              {isPending ? "Connecting..." : `Connect & Open ${role === "parent" ? "Parent" : "Student"} Portal`}
              <ArrowRightIcon className="size-4" />
            </Button>
          </div>
        ) : (
          /* If not logged in: Quick Sign In / Up */
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                1. Select your role
              </Label>
              <Tabs value={role} onValueChange={(v) => setRole(v as "student" | "parent")} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="student" className="gap-1.5">
                    <GraduationCapIcon className="size-4" />
                    I am {student.name}
                  </TabsTrigger>
                  <TabsTrigger value="parent" className="gap-1.5">
                    <ShieldCheckIcon className="size-4" />
                    I am the Parent
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Google button */}
            <Button
              variant="outline"
              className="w-full h-11 border-slate-200 bg-white hover:bg-slate-50 shadow-sm gap-2 text-sm font-medium"
              onClick={handleGoogleAuth}
              disabled={isPending}
            >
              <svg className="size-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </Button>

            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 border-t border-slate-200" />
              <span className="relative bg-white px-2 text-[11px] uppercase tracking-wider text-slate-400">
                Or with email
              </span>
            </div>

            {/* Email form */}
            <div className="space-y-3">
              <div className="flex gap-2 text-xs mb-1">
                <button
                  type="button"
                  className={`font-semibold pb-1 border-b-2 transition-all ${
                    authMode === "signup"
                      ? "border-primary text-primary"
                      : "border-transparent text-slate-400"
                  }`}
                  onClick={() => setAuthMode("signup")}
                >
                  Create new account
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  className={`font-semibold pb-1 border-b-2 transition-all ${
                    authMode === "login"
                      ? "border-primary text-primary"
                      : "border-transparent text-slate-400"
                  }`}
                  onClick={() => setAuthMode("login")}
                >
                  I already have an account
                </button>
              </div>

              {authMode === "signup" && (
                <div className="space-y-1">
                  <Label htmlFor="join-name" className="text-xs">Your full name</Label>
                  <Input
                    id="join-name"
                    placeholder={role === "student" ? student.name : "Parent Name"}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="join-email" className="text-xs">Email address</Label>
                <Input
                  id="join-email"
                  type="email"
                  placeholder={role === "student" ? "student@example.com" : "parent@example.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="join-password" className="text-xs">Password</Label>
                <Input
                  id="join-password"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button
                className="w-full h-11 text-sm font-semibold shadow-sm mt-2"
                onClick={handleEmailAuth}
                disabled={isPending}
              >
                {isPending ? "Connecting..." : authMode === "signup" ? "Join & Enter Portal" : "Login & Enter Portal"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

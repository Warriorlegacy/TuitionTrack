import Link from "next/link";
import { Brand } from "@/components/brand";
import { AuthCard } from "@/components/auth/auth-card";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="shell-gradient hidden rounded-[2rem] border border-white/70 p-10 shadow-soft lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-6">
            <Brand />
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold text-slate-950">
                Launch your teaching CRM with a portal for everyone.
              </h1>
              <p className="max-w-md text-base leading-7 text-slate-600">
                Signup for teachers is optimized for onboarding. Parents and students gain instant 
                access to reports once their emails are mapped to student records.
              </p>
            </div>
          </div>
          <div className="rounded-3xl border border-white/80 bg-white/75 p-6 text-sm text-slate-600">
            Deployment-ready on Next.js 14, Supabase, Tailwind, shadcn/ui, Zustand, Recharts, and
            Vercel.
          </div>
        </section>
        <section className="flex flex-col justify-center gap-5">
          <AuthCard mode="signup" />
          <p className="text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary">
              Login instead
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

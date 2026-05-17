import Link from "next/link";
import { Brand } from "@/components/brand";
import { AuthCard } from "@/components/auth/auth-card";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="shell-gradient hidden rounded-[2rem] border border-white/70 p-10 shadow-soft lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-6">
            <Brand />
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold text-slate-950">
                Clarity for parents. Freedom for teachers.
              </h1>
              <p className="max-w-md text-base leading-7 text-slate-600">
                Login to access your dashboard. Teachers manage operations, while parents and students 
                track progress with real-time sync.
              </p>
            </div>
          </div>
          <div className="rounded-3xl border border-white/80 bg-white/75 p-6 text-sm text-slate-600">
            Homework, attendance, test results, fees, announcements, and progress reports all stay
            in sync from one secure portal.
          </div>
        </section>
        <section className="flex flex-col justify-center gap-5">
          <AuthCard mode="login" />
          <p className="text-center text-sm text-slate-500">
            New here?{" "}
            <Link href="/signup" className="font-medium text-primary">
              Create a teacher account
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

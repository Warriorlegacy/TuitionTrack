import Link from "next/link";
import { Brand } from "@/components/brand";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/70 bg-white/65 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex flex-col gap-2">
          <Brand />
          <p className="text-xs text-slate-400">
            &copy; {year} TuitionTrack. Built with Next.js &amp; Supabase.
          </p>
        </div>
        <div className="flex flex-wrap gap-6 text-sm text-slate-500">
          <Link href="/pricing" className="hover:text-slate-950">Pricing</Link>
          <Link href="/login" className="hover:text-slate-950">Login</Link>
          <Link href="/signup" className="hover:text-slate-950">Signup</Link>
          <Link href="/app/dashboard" className="hover:text-slate-950">App</Link>
        </div>
      </div>
    </footer>
  );
}

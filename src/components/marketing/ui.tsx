"use client";

// Marketing primitives for the /ai cinematic site (Blueprint #78, vertical slice only).
// ponytail: one file, reuses ui/button + ui/skeleton + ui/empty + cn. No new deps.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRightIcon, GraduationCapIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type LoadState = "ready" | "loading" | "empty" | "error";

type BtnVariant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
type BtnSize = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";

// ── MagneticButton: subtle hover physics, inert for touch + reduced motion (#74) ──
export function MagneticButton({
  href,
  children,
  variant = "default",
  size = "lg",
  className,
}: {
  href?: string;
  children: React.ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const coarse = useRef(false);
  useEffect(() => {
    coarse.current = window.matchMedia("(pointer: coarse)").matches;
  }, []);

  const cls = cn(
    buttonVariants({ variant, size }),
    "tt-focus h-12 rounded-tt-md px-7 text-base",
    className,
  );
  const body = (
    <>
      {children}
      <ArrowRightIcon className="ml-1 size-4" aria-hidden />
    </>
  );

  return (
    <motion.span
      className="inline-flex"
      animate={reduce ? { x: 0, y: 0 } : offset}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      onMouseMove={(e) => {
        if (reduce || coarse.current) return;
        const r = e.currentTarget.getBoundingClientRect();
        setOffset({
          x: Math.max(-6, Math.min(6, (e.clientX - (r.left + r.width / 2)) / 8)),
          y: Math.max(-6, Math.min(6, (e.clientY - (r.top + r.height / 2)) / 8)),
        });
      }}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
    >
      {href ? (
        <Link href={href} className={cls}>
          {body}
        </Link>
      ) : (
        <Button variant={variant} size={size} className={cn("tt-focus h-12 rounded-tt-md px-7 text-base", className)}>
          {body}
        </Button>
      )}
    </motion.span>
  );
}

// ── SectionHeading: mono eyebrow + display title + body (#77 type system) ──
export function SectionHeading({
  eyebrow,
  title,
  sub,
  dark = false,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  dark?: boolean;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("max-w-2xl space-y-4", align === "center" ? "mx-auto text-center" : "text-left")}>
      <p className={cn("tt-mono-label text-xs", dark ? "text-tt-accent" : "text-primary")}>{eyebrow}</p>
      <h2 className={cn("tt-display text-3xl font-semibold sm:text-4xl lg:text-5xl", dark ? "text-white" : "text-slate-950")}>
        {title}
      </h2>
      {sub ? <p className={cn("text-base leading-7", dark ? "text-slate-300" : "text-slate-600")}>{sub}</p> : null}
    </div>
  );
}

// ── GlassPanel: restrained glass for dark sections ──
export function GlassPanel({ children, className, ...rest }: React.ComponentProps<"div">) {
  return (
    <div className={cn("tt-glass rounded-tt-lg", className)} {...rest}>
      {children}
    </div>
  );
}

// ── BentoCard: shadcn Card + loading/empty/error states (every feature needs them) ──
export function BentoCard({
  icon,
  title,
  desc,
  status = "ready",
  error,
  className,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  desc?: string;
  status?: LoadState;
  error?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  if (status === "loading") {
    return (
      <Card className={cn("rounded-tt-md", className)} aria-busy="true" aria-label={`${title} loading`}>
        <CardHeader className="space-y-3">
          <Skeleton className="size-10 rounded-tt-sm" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
      </Card>
    );
  }
  if (status === "error") {
    return (
      <Card className={cn("rounded-tt-md", className)} role="alert">
        <CardHeader>
          <CardTitle className="text-base">{title} couldn’t load</CardTitle>
          <CardDescription>{error ?? "Check your connection and try again."}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (status === "empty") {
    return (
      <Card className={cn("rounded-tt-md", className)}>
        <Empty>
          <EmptyTitle>{title} — nothing here yet</EmptyTitle>
          <EmptyDescription>New activity will appear here once students start practising.</EmptyDescription>
        </Empty>
      </Card>
    );
  }
  return (
    <Card className={cn("rounded-tt-md transition-transform duration-300 hover:-translate-y-1", className)}>
      <CardHeader className="space-y-3">
        {icon ? (
          <div className="flex size-10 items-center justify-center rounded-tt-sm bg-primary/10 text-primary" aria-hidden>
            {icon}
          </div>
        ) : null}
        <CardTitle className="text-lg">{title}</CardTitle>
        {desc ? <CardDescription className="leading-6">{desc}</CardDescription> : null}
      </CardHeader>
      {children}
    </Card>
  );
}

// ── Metric: animated tabular counter + states ──
export function Metric({
  value,
  label,
  prefix = "",
  suffix = "",
  status = "ready",
  caption,
}: {
  value: number | null;
  label: string;
  prefix?: string;
  suffix?: string;
  status?: LoadState;
  caption?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!inView || status !== "ready" || value == null) return;
    if (reduce) {
      setDisplay(String(value));
      return;
    }
    const controls = animate(0, value, {
      duration: 1.4,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(value % 1 === 0 ? String(Math.round(v)) : v.toFixed(1)),
    });
    return () => controls.stop();
  }, [inView, value, status, reduce]);

  if (status === "loading") {
    return (
      <div ref={ref} aria-busy="true" aria-label={`${label} loading`}>
        <Skeleton className="h-9 w-24" />
        <Skeleton className="mt-2 h-4 w-32" />
      </div>
    );
  }
  if (status === "error" || value == null) {
    return (
      <div ref={ref} role={status === "error" ? "alert" : undefined} className="text-sm text-slate-500">
        {status === "error" ? "Metric unavailable — retry shortly." : `No ${label.toLowerCase()} data yet.`}
      </div>
    );
  }
  return (
    <div ref={ref}>
      <p className="tt-tnum text-4xl font-semibold tracking-tight text-white" aria-label={`${label}: ${prefix}${display}${suffix}`}>
        {prefix}
        {display}
        {suffix}
      </p>
      <p className="mt-1 text-sm text-slate-300">{label}</p>
      {caption ? <p className="mt-0.5 text-xs text-slate-400">{caption}</p> : null}
    </div>
  );
}

export function MetricTicker({
  items,
  status = "ready",
}: {
  items: { value: number | null; label: string; prefix?: string; suffix?: string; caption?: string }[];
  status?: LoadState;
}) {
  if (status === "empty" && items.length === 0) {
    return (
      <Empty>
        <EmptyTitle>No metrics yet</EmptyTitle>
        <EmptyDescription>Metrics appear after the first diagnostic.</EmptyDescription>
      </Empty>
    );
  }
  return (
    <dl className="grid gap-8 sm:grid-cols-3">
      {items.map((m) => (
        <div key={m.label}>
          <dt className="sr-only">{m.label}</dt>
          <dd>
            <Metric value={m.value} label={m.label} prefix={m.prefix} suffix={m.suffix} caption={m.caption} status={status} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ── MasteryRing: SVG progress ring (no lib needed) ──
export function MasteryRing({
  value,
  size = 132,
  label = "Mastery",
  status = "ready",
}: {
  value: number | null;
  size?: number;
  label?: string;
  status?: LoadState;
}) {
  if (status === "loading" || value == null) {
    return <Skeleton className="rounded-full" style={{ width: size, height: size }} aria-label={`${label} loading`} aria-busy="true" />;
  }
  if (status === "error") {
    return (
      <div role="alert" className="text-sm text-slate-500">
        {label} unavailable.
      </div>
    );
  }
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="inline-flex flex-col items-center gap-2" role="img" aria-label={`${label} ${Math.round(clamped)} percent`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="10" className="stroke-slate-200" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke="currentColor"
          className="text-primary transition-[stroke-dashoffset] duration-700"
          strokeDasharray={c}
          strokeDashoffset={c - (c * clamped) / 100}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="tt-tnum fill-slate-950 text-xl font-semibold">
          {Math.round(clamped)}%
        </text>
      </svg>
      <p className="tt-mono-label text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

// ── Navbar: cinematic dark pill, keyboard navigable ──
const NAV_LINKS = [
  { href: "/ai#how", label: "How it works" },
  { href: "/ai#loop", label: "Learning loop" },
  { href: "/pricing", label: "Plans" },
  { href: "/login", label: "Sign in" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <nav
        aria-label="TuitionTrack AI"
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-tt-md border border-white/10 bg-tt-hero/80 py-3 pl-5 pr-3 shadow-2xl backdrop-blur-xl"
      >
        <Link href="/ai" className="tt-focus flex items-center gap-2.5 rounded-tt-sm" aria-label="TuitionTrack AI home">
          <span className="flex size-8 items-center justify-center rounded-tt-sm bg-tt-accent/20 text-tt-accent" aria-hidden>
            <GraduationCapIcon className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">
            TuitionTrack <span className="text-tt-accent">AI</span>
          </span>
        </Link>
        <ul className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="tt-focus rounded-sm transition-colors hover:text-white">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <Link
            href="/signup"
            className={cn(buttonVariants({ size: "sm" }), "tt-focus hidden rounded-tt-sm px-5 sm:inline-flex")}
          >
            Start preparing
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="tt-focus rounded-tt-sm text-slate-200 hover:bg-white/10 hover:text-white md:hidden"
            aria-expanded={open}
            aria-controls="ai-mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : "Menu"}
          </Button>
        </div>
      </nav>
      {open ? (
        <ul
          id="ai-mobile-nav"
          className="mx-auto mt-2 max-w-6xl space-y-1 rounded-tt-md border border-white/10 bg-tt-hero/95 p-3 text-sm text-slate-200 backdrop-blur-xl md:hidden"
        >
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => setOpen(false)}
                className="tt-focus block rounded-tt-sm px-4 py-3 hover:bg-white/10 hover:text-white"
              >
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className={cn(buttonVariants({ size: "sm" }), "tt-focus mt-1 w-full rounded-tt-sm")}
            >
              Start preparing
            </Link>
          </li>
        </ul>
      ) : null}
    </header>
  );
}

// ── Footer: quiet close for the cinematic route (app footer untouched) ──
export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-tt-hero px-4 py-14 text-slate-400 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <GraduationCapIcon className="size-4 text-tt-accent" aria-hidden />
            TuitionTrack AI
          </p>
          <p className="max-w-sm text-sm leading-6">
            From tuition class to exam readiness — one adaptive learning loop for India’s students, tutors and parents.
          </p>
        </div>
        <nav aria-label="Product">
          <p className="tt-mono-label mb-4 text-[11px] text-slate-500">Product</p>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/ai#how" className="tt-focus rounded-sm hover:text-white">How it works</Link></li>
            <li><Link href="/ai#loop" className="tt-focus rounded-sm hover:text-white">Learning loop</Link></li>
            <li><Link href="/app/dashboard" className="tt-focus rounded-sm hover:text-white">Open app</Link></li>
          </ul>
        </nav>
        <nav aria-label="Account">
          <p className="tt-mono-label mb-4 text-[11px] text-slate-500">Account</p>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/pricing" className="tt-focus rounded-sm hover:text-white">Plans</Link></li>
            <li><Link href="/login" className="tt-focus rounded-sm hover:text-white">Sign in</Link></li>
            <li><Link href="/signup" className="tt-focus rounded-sm hover:text-white">Create account</Link></li>
          </ul>
        </nav>
      </div>
      <p className="mx-auto mt-12 max-w-6xl border-t border-white/10 pt-6 text-xs text-slate-500">
        © 2026 TuitionTrack AI · Sample metrics on this page illustrate the product.
      </p>
    </footer>
  );
}

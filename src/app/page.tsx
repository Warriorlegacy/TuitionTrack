import Link from "next/link";
import {
  ArrowRightIcon,
  BellDotIcon,
  BookOpenCheckIcon,
  ChevronDownIcon,
  CreditCardIcon,
  DownloadIcon,
  LineChartIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  SparklesIcon,
  UsersRoundIcon,
  ZapIcon,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: BookOpenCheckIcon,
    title: "Homework that parents actually see",
    description:
      "Assign work to one student or an entire batch and keep completion status visible in real time.",
  },
  {
    icon: UsersRoundIcon,
    title: "Attendance, tests, fees in one place",
    description:
      "Turn day-to-day tuition admin into a single workflow instead of scattered notebooks and chats.",
  },
  {
    icon: BellDotIcon,
    title: "Announcements with instant visibility",
    description:
      "Broadcast updates once and surface them across the parent and student portal without duplicate effort.",
  },
  {
    icon: LineChartIcon,
    title: "Progress reporting that feels premium",
    description:
      "Generate visual progress summaries with attendance trends, marks history, and fee status at a glance.",
  },
];

const stats = [
  { label: "Manual follow-up reduced", value: "68%" },
  { label: "Teacher-ready modules", value: "8" },
  { label: "Student touchpoints tracked", value: "Homework, fees, tests" },
];

const steps = [
  {
    number: "01",
    icon: SparklesIcon,
    title: "Onboard in minutes",
    description:
      "Sign up, add your students with parent and student emails, and your portal is live. No training needed.",
  },
  {
    number: "02",
    icon: ZapIcon,
    title: "Manage everything daily",
    description:
      "Assign homework, mark attendance, record test scores, add fees, and broadcast announcements — all from one dashboard.",
  },
  {
    number: "03",
    icon: ShieldCheckIcon,
    title: "Parents & students stay informed",
    description:
      "Parents and students log in to see homework, marks, fees, and updates. No more WhatsApp follow-ups.",
  },
];

const testimonials = [
  {
    name: "Priya Sharma",
    role: "Math & Science Tutor · Delhi",
    quote:
      "Before TuitionTrack I was sending homework on WhatsApp and losing track. Now parents see everything instantly and I've cut follow-up time by 70%.",
  },
  {
    name: "Rajesh Patel",
    role: "Coaching Center Owner · Ahmedabad",
    quote:
      "We switched from paper registers to TuitionTrack in a weekend. Fee collection visibility alone made it worth it — parents pay on time now.",
  },
  {
    name: "Ananya Iyer",
    role: "English & History Tutor · Bangalore",
    quote:
      "The progress reports look so professional that parents show them to school counselors. My credibility went up overnight.",
  },
];

const faqs = [
  {
    question: "How do parents and students access the portal?",
    answer:
      "When you add a student record, you include their parent email and student email. Those emails can log in and automatically see all data linked to their students — homework, attendance, fees, marks, and announcements.",
  },
  {
    question: "Is TuitionTrack only for math or science tutors?",
    answer:
      "No, TuitionTrack works for every subject and teaching format — solo tutors, coaching centers, music teachers, language instructors. The modules are subject-agnostic.",
  },
  {
    question: "Can multiple teachers use the same account?",
    answer:
      "Each teacher account has its own isolated workspace. Students, homework, and all data are scoped to that teacher's login. For coaching centers with multiple teachers, each teacher signs up separately.",
  },
  {
    question: "What happens to my data? Is it secure?",
    answer:
      "TuitionTrack is built on Supabase with Row Level Security. Every database query is scoped to the authenticated user. Teachers can only see their own students, and parents can only see their own linked children.",
  },
  {
    question: "Can I self-host TuitionTrack?",
    answer:
      "Yes. TuitionTrack is built with Next.js and Supabase. You can deploy to Vercel (or any Node.js host) and point to your own Supabase project for full data ownership.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        {/* ── Hero ──────────────────────────────────────────── */}
        <section className="px-4 pb-16 pt-10 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-8 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
                <ShieldCheckIcon className="size-4" />
                Built for tutors, coaching centers, and modern parent communication
              </div>
              <div className="space-y-5">
                <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                  Tuition operations, student progress, and parent visibility in one clean SaaS.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-slate-600">
                  TuitionTrack helps teachers assign homework, track attendance, collect fees,
                  share announcements, and report progress without juggling spreadsheets, WhatsApp,
                  and paper registers.
                </p>
              </div>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Link
                    href="/signup"
                    className={cn(
                      buttonVariants({ size: "lg" }),
                      "h-14 px-8 text-base shadow-lg shadow-primary/20"
                    )}
                  >
                    Get started for free <ArrowRightIcon className="ml-2 size-5" />
                  </Link>
                  <a
                    href="/TuitionTrack.apk"
                    download
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "h-14 border-slate-200 px-8 text-base transition-all hover:bg-slate-50"
                    )}
                  >
                    <DownloadIcon className="mr-2 size-5" /> Get Android APK
                  </a>
                </div>
              <div className="stagger-children grid gap-4 rounded-3xl border border-white/80 bg-white/70 p-5 shadow-soft backdrop-blur sm:grid-cols-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="space-y-2">
                    <p className="text-2xl font-semibold text-slate-950">{stat.value}</p>
                    <p className="text-sm text-slate-500">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="animate-float shell-gradient rounded-[2rem] border border-white/80 p-4 shadow-soft" style={{ animationDelay: "200ms" }}>
              <div className="glass-card overflow-hidden">
                <div className="border-b border-slate-200/80 px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Teacher dashboard</p>
                      <p className="mt-1 text-xl font-semibold text-slate-950">Today at a glance</p>
                    </div>
                    <div className="animate-pulse-ring rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      Live updates
                    </div>
                  </div>
                </div>
                <div className="stagger-children grid gap-4 p-6 sm:grid-cols-2">
                  {[
                    ["Total students", "124"],
                    ["Pending homework", "19"],
                    ["Fees pending", "₹32,400"],
                    ["Attendance today", "91%"],
                  ].map(([label, value]) => (
                    <Card
                      key={label}
                      className="border-0 bg-slate-50/90 shadow-none ring-1 ring-slate-200/80"
                    >
                      <CardHeader>
                        <CardDescription>{label}</CardDescription>
                        <CardTitle className="text-3xl font-semibold">{value}</CardTitle>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
                <div className="grid gap-4 border-t border-slate-200/80 bg-slate-50/70 p-6 lg:grid-cols-[1fr_0.88fr]">
                  <Card className="border-0 bg-white shadow-none ring-1 ring-slate-200/80">
                    <CardHeader>
                      <CardDescription>Recent activity</CardDescription>
                      <CardTitle className="text-lg">Homework, tests, reminders</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 text-sm text-slate-600">
                      <div className="rounded-xl bg-slate-50 p-3">
                        Algebra worksheet assigned to Class 9 batch A
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        March fee reminder sent to 12 parents
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        Science test scores updated for 18 students
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 bg-white shadow-none ring-1 ring-slate-200/80">
                    <CardHeader>
                      <CardDescription>Parent visibility</CardDescription>
                      <CardTitle className="text-lg">Shared portal summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-slate-600">
                      <div className="rounded-2xl bg-primary/8 p-4 text-primary">
                        Parents see homework due dates, fee reminders, attendance, and marks from a
                        single login.
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        Students get a cleaner read-only view for homework and marks.
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────── */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-2xl space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                Product capabilities
              </p>
              <h2 className="text-3xl font-semibold text-slate-950 sm:text-4xl">
                Everything a tuition business needs to stay organized and trusted.
              </h2>
            </div>
            <div className="stagger-children grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {features.map((feature) => (
                <Card key={feature.title} className="group border-white/90 bg-white/80 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <CardHeader className="space-y-4">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                      <feature.icon className="size-5" />
                    </div>
                    <div className="space-y-2">
                      <CardTitle>{feature.title}</CardTitle>
                      <CardDescription className="leading-6">
                        {feature.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────── */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                How it works
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">
                From signup to parent portal in three simple steps.
              </h2>
            </div>
            <div className="relative grid gap-8 md:grid-cols-3">
              {/* Connecting line */}
              <div className="absolute left-0 right-0 top-[52px] hidden h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent md:block" />
              {steps.map((step, index) => (
                <div
                  key={step.number}
                  className="relative flex flex-col items-center text-center"
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <div className="relative z-10 mb-6 flex size-[72px] items-center justify-center rounded-3xl bg-primary/10 ring-4 ring-white">
                    <step.icon className="size-7 text-primary" />
                    <span className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-soft">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-slate-950">{step.title}</h3>
                  <p className="max-w-xs text-sm leading-6 text-slate-600">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ─────────────────────────────────── */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                Trusted by teachers
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">
                Hear from tutors who switched to TuitionTrack.
              </h2>
            </div>
            <div className="stagger-children grid gap-6 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <Card
                  key={testimonial.name}
                  className="group border-white/90 bg-white/85 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <CardContent className="space-y-5 p-7">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} className="size-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <p className="text-sm leading-7 text-slate-600">
                      &ldquo;{testimonial.quote}&rdquo;
                    </p>
                    <div className="border-t border-slate-100 pt-4">
                      <p className="text-sm font-semibold text-slate-950">{testimonial.name}</p>
                      <p className="text-xs text-slate-500">{testimonial.role}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────── */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-12 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                Frequently asked questions
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">
                Everything you need to know.
              </h2>
            </div>
            <div className="space-y-3">
              {faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="group glass-card overflow-hidden"
                >
                  <summary className="flex items-center justify-between gap-4 px-6 py-5 transition-colors hover:bg-slate-50/60">
                    <span className="text-sm font-semibold text-slate-950">{faq.question}</span>
                    <ChevronDownIcon className="faq-chevron size-4 flex-none text-slate-400" />
                  </summary>
                  <div className="faq-answer border-t border-slate-100 px-6 py-5">
                    <p className="text-sm leading-7 text-slate-600">{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Mobile App Download ─────────────────────────── */}
        <section id="download-app" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-8 shadow-2xl sm:p-12 lg:p-16">
              {/* Background decorative elements */}
              <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-blue-500/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full bg-cyan-500/8 blur-3xl" />
              <div className="pointer-events-none absolute right-1/3 top-1/2 size-64 rounded-full bg-primary/5 blur-3xl" />

              <div className="relative z-10 grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
                {/* Left content */}
                <div className="space-y-8 animate-fade-in-up">
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300">
                    <SmartphoneIcon className="size-4" />
                    Available on iOS &amp; Android
                  </div>

                  <div className="space-y-5">
                    <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                      Take TuitionTrack everywhere in your pocket.
                    </h2>
                    <p className="max-w-lg text-base leading-7 text-slate-400">
                      Manage homework, attendance, and fees on the go. Parents get instant updates
                      and students can check assignments — all from a native mobile experience.
                    </p>
                  </div>

                  {/* Feature pills */}
                  <div className="flex flex-wrap gap-3">
                    {["Offline-capable", "Push notifications", "Native feel", "Instant sync"].map(
                      (feature) => (
                        <span
                          key={feature}
                          className="rounded-full border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-medium text-slate-300"
                        >
                          {feature}
                        </span>
                      ),
                    )}
                  </div>

                  {/* Primary Download Button */}
                  <div className="pb-4">
                    <a
                      href="/TuitionTrack.apk"
                      download
                      className={cn(
                        buttonVariants({ size: "lg" }),
                        "h-14 w-full bg-blue-600 px-8 text-base font-semibold shadow-lg shadow-blue-500/25 hover:bg-blue-700 sm:w-auto"
                      )}
                    >
                      <DownloadIcon className="mr-2 size-5" /> Get Android APK (.apk)
                    </a>
                  </div>

                  {/* Secondary Store Links */}
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="flex flex-wrap gap-4">
                      {/* iOS App Store Badge - Directs to APK for now since iOS isn't published */}
                      <a
                        href="/TuitionTrack.apk"
                        download
                        aria-label="Download iOS App Beta"
                        className="group relative inline-flex h-[56px] w-[190px] items-center gap-3 overflow-hidden rounded-xl bg-white/[0.06] px-5 ring-1 ring-white/10 backdrop-blur transition-all duration-300 hover:bg-white/[0.12] hover:ring-white/25"
                      >
                        {/* Apple logo */}
                        <svg className="size-7 shrink-0 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                        </svg>
                        <div className="flex flex-col leading-tight">
                          <span className="text-[10px] font-medium text-slate-400">Download on the</span>
                          <span className="text-base font-semibold text-white">App Store</span>
                        </div>
                      </a>

                      {/* Google Play Badge */}
                      <a
                        href="/TuitionTrack.apk"
                        download
                        aria-label="Download Android App"
                        className="group relative inline-flex h-[56px] w-[190px] items-center gap-3 overflow-hidden rounded-xl bg-white/[0.06] px-5 ring-1 ring-white/10 backdrop-blur transition-all duration-300 hover:bg-white/[0.12] hover:ring-white/25"
                      >
                        {/* Google Play triangle */}
                        <svg className="size-7 shrink-0" viewBox="0 0 24 24" fill="none">
                          <path d="M3.609 1.814L13.793 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92z" fill="#4285F4" />
                          <path d="M17.556 8.237L5.156.78a.993.993 0 0 0-1.079.065L14.5 11.27l3.056-3.033z" fill="#EA4335" />
                          <path d="M21 12a.999.999 0 0 0-.496-.864l-3.948-2.262L13.5 12l3.056 3.126 3.948-2.262A.999.999 0 0 0 21 12z" fill="#FBBC04" />
                          <path d="M3.61 22.186L14.5 12.73l3.056 3.033-11.4 6.458a1.006 1.006 0 0 1-1.079.065L3.61 22.186z" fill="#34A853" />
                        </svg>
                        <div className="flex flex-col leading-tight">
                          <span className="text-[10px] font-medium text-slate-400">GET IT ON</span>
                          <span className="text-base font-semibold text-white">Google Play</span>
                        </div>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Right side — Phone mockup */}
                <div className="relative flex justify-center animate-float" style={{ animationDelay: "400ms" }}>
                  {/* Glow behind phone */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-72 rounded-full bg-blue-500/20 blur-[80px]" />

                  {/* Phone frame */}
                  <div className="relative w-[260px] rounded-[2.5rem] border-[6px] border-slate-700/80 bg-slate-900 shadow-2xl shadow-black/50">
                    {/* Notch */}
                    <div className="absolute left-1/2 top-0 z-20 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-slate-900" />

                    {/* Screen content */}
                    <div className="rounded-[2rem] bg-gradient-to-b from-slate-800 to-slate-900 p-5 pt-10">
                      {/* Status bar */}
                      <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                        <span>9:41</span>
                        <div className="flex items-center gap-1">
                          <div className="flex gap-px">
                            {[12, 14, 10, 16].map((h, i) => (
                              <div key={i} className="w-[3px] rounded-full bg-slate-600" style={{ height: `${h}px` }} />
                            ))}
                          </div>
                          <div className="ml-1 h-3 w-6 rounded-sm border border-slate-600 bg-slate-700/50" />
                        </div>
                      </div>

                      {/* Mini dashboard mockup */}
                      <div className="mt-5 space-y-4">
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-500">Welcome back</p>
                          <p className="text-sm font-semibold text-white">Teacher Dashboard</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {[
                            ["Students", "124", "text-blue-400"],
                            ["Pending", "19", "text-amber-400"],
                            ["Fees Due", "₹32K", "text-red-400"],
                            ["Attendance", "91%", "text-emerald-400"],
                          ].map(([label, value, color]) => (
                            <div
                              key={label}
                              className="rounded-xl bg-slate-800/80 p-3 ring-1 ring-slate-700/50"
                            >
                              <p className="text-[9px] text-slate-500">{label}</p>
                              <p className={`text-lg font-bold ${color}`}>{value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-medium text-slate-400">Recent</p>
                          {["Algebra worksheet assigned", "Fee reminder sent", "Test scores updated"].map(
                            (item) => (
                              <div
                                key={item}
                                className="rounded-lg bg-slate-800/60 px-3 py-2 text-[10px] text-slate-400 ring-1 ring-slate-700/30"
                              >
                                {item}
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Home indicator */}
                    <div className="flex justify-center py-2">
                      <div className="h-1 w-24 rounded-full bg-slate-600" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────── */}
        <section className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="glass-card flex flex-col gap-8 p-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <Brand />
                <h3 className="text-3xl font-semibold text-slate-950">
                  Launch a parent-ready portal without building admin workflows from scratch.
                </h3>
                <p className="max-w-2xl text-slate-600">
                  Built on Next.js, Supabase, and Vercel-friendly patterns so you can deploy fast
                  and scale cleanly.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button render={<Link href="/login" />}>Login</Button>
                <Button variant="outline" render={<Link href="/signup" />}>
                  Create account
                </Button>
                <Button variant="secondary" render={<Link href="/app/dashboard" />}>
                  Open app
                  <CreditCardIcon data-icon="inline-end" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

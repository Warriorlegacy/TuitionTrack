import Link from "next/link";
import { CheckCircle2Icon } from "lucide-react";
import { Brand } from "@/components/brand";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const plans = [
  {
    title: "Solo Tutor",
    price: "₹999",
    description: "For independent tutors managing up to 100 active students.",
    features: [
      "Homework, attendance, fees, tests, and reports",
      "Parent and student read-only portal access",
      "Realtime announcements and recent activity",
    ],
  },
  {
    title: "Coaching Center",
    price: "₹2,999",
    description: "For growing centers coordinating multiple batches and parent communication.",
    features: [
      "Unlimited student records",
      "Performance charts and operational dashboards",
      "Priority support and onboarding assistance",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="space-y-4 text-center">
            <Brand className="justify-center" />
            <h1 className="text-4xl font-semibold text-slate-950 sm:text-5xl">
              Straightforward pricing for modern tuition operations.
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-slate-600">
              Choose the plan that fits your teaching model and deploy TuitionTrack on your own
              Vercel and Supabase stack.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {plans.map((plan) => (
              <Card key={plan.title} className="border-white/90 bg-white/90 shadow-soft">
                <CardHeader className="space-y-4">
                  <div>
                    <CardTitle className="text-2xl">{plan.title}</CardTitle>
                    <CardDescription className="mt-2">{plan.description}</CardDescription>
                  </div>
                  <div className="text-4xl font-semibold text-slate-950">
                    {plan.price}
                    <span className="ml-2 text-base font-medium text-slate-500">/ month</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3 text-sm text-slate-600">
                      <CheckCircle2Icon className="mt-0.5 size-4 text-primary" />
                      <span>{feature}</span>
                    </div>
                  ))}
                  <Button className="mt-4 w-full" render={<Link href="/signup" />}>
                    Start with {plan.title}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

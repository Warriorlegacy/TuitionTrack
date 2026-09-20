import { MessageCircleIcon, ShieldCheckIcon, BookOpenIcon, ExternalLinkIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { requireParentContext } from "@/lib/parent/auth";
import { getPaymentSettings } from "@/lib/parent/payments";

export const dynamic = "force-dynamic";

export const metadata = { title: "Support · TuitionTrack" };

const FAQS = [
  {
    q: "How do I link another child to my account?",
    a: "Your child's teacher must send a new invitation link. Each invitation is unique and single-use. Ask the teacher to issue one — you cannot add a child yourself for security reasons.",
  },
  {
    q: "How do I submit a fee payment?",
    a: "Go to Fees and find the outstanding fee. Use the UPI ID shown to make the payment, then upload the screenshot and enter your UTR (transaction reference). The teacher will verify it and you will receive confirmation.",
  },
  {
    q: "Why does my fees page say fee visibility is disabled?",
    a: "The teacher controls what each guardian can see. Ask your child's teacher to enable fee visibility on your linked account.",
  },
  {
    q: "What is the difference between Coverage and Mastery?",
    a: "Coverage tracks what chapters the teacher has assigned work on — it tracks the syllabus, not learning. Mastery tracks what your child has actually demonstrated through practice and assessments. A chapter can be fully covered and still not mastered — which is why we never combine these numbers.",
  },
  {
    q: "Why do some sections show no data?",
    a: "TuitionTrack only shows real data. If a section shows nothing, it means nothing has been recorded yet — we will never show an estimate, a percentage calculated from zero, or a placeholder number. This ensures you are never misled.",
  },
  {
    q: "How do I report a problem with the portal?",
    a: "Use the WhatsApp contact below. Please include your name, your child's name, and a description of the issue. Do not share your password or invite links over WhatsApp.",
  },
] as const;

export default async function ParentSupportPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const requested = typeof searchParams?.child === "string" ? searchParams.child : undefined;
  await requireParentContext(requested);

  // WhatsApp number from payment_settings (same number configured for payment verification)
  const settings = await getPaymentSettings().catch(() => null);
  const whatsapp = settings?.payment_whatsapp_number ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Support</h1>
        <p className="mt-1 text-sm text-slate-600">Help, FAQs and how to contact your teacher</p>
      </div>

      {/* Contact */}
      {whatsapp && (
        <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-green-50">
              <MessageCircleIcon className="size-5 text-green-600" aria-hidden />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Contact the teacher</p>
              <p className="text-sm text-slate-500">WhatsApp · {whatsapp}</p>
            </div>
          </div>
          <a
            href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
          >
            Open WhatsApp
            <ExternalLinkIcon className="size-4" aria-hidden />
          </a>

          {/* Safety notice */}
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50 p-3">
            <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
            <p className="text-xs leading-relaxed text-amber-800">
              <strong className="font-semibold">Security reminder:</strong> TuitionTrack staff
              will never ask for your account password, invite link, or OTP over WhatsApp or any
              other channel.
            </p>
          </div>
        </Card>
      )}

      {/* FAQs */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <BookOpenIcon className="size-3.5" aria-hidden />
          Frequently asked questions
        </h2>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <Card key={i} className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft">
              <p className="text-sm font-semibold text-slate-900">{faq.q}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{faq.a}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <Card className="flex items-start gap-3 rounded-2xl border-slate-200 bg-slate-50 p-4">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
        <p className="text-xs leading-relaxed text-slate-500">
          Your portal access is secured by a verified guardian link. Every record view and action is
          logged with a timestamp. If you believe you have seen another child&apos;s data, report it
          immediately using the WhatsApp contact above.
        </p>
      </Card>
    </div>
  );
}

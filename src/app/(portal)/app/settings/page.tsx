import { requireAuthContext } from "@/lib/auth";
import { getSettingsPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { AiSettings } from "@/components/settings/ai-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, MessageCircle } from "lucide-react";

import { WorkspaceSettingsCard } from "@/components/workspace/workspace-settings-card";
import { getWorkspaceContextForUser, listWorkspaceMembers } from "@/lib/workspace/auth";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";

export default async function SettingsPage() {
  const context = await requireAuthContext();
  const data = await getSettingsPageData(context);

  const wsContext = context.user ? await getWorkspaceContextForUser(context.user.id) : null;
  const workspace = wsContext?.workspace;
  const membersRes = workspace && context.user ? await listWorkspaceMembers(workspace.id, context.user.id) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage profile details, classroom workspace code, and confirm portal access."
      />
      <ProfileForm
        initialName={data.profile?.name ?? ""}
        email={data.profile?.email ?? context.user?.email ?? ""}
        role={context.role!}
      />

      {workspace && (
        <WorkspaceSettingsCard
          workspace={workspace}
          memberCount={membersRes?.members?.length || 0}
        />
      )}

      <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-violet-900">
            <Smartphone className="size-5" />
            Subscription &amp; Payments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-slate-700">
          <p>
            To upgrade your plan or renew your subscription, pay via UPI and send
            the screenshot to our WhatsApp for instant confirmation.
          </p>
          <div className="rounded-xl border border-violet-200 bg-white/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-violet-600">
              UPI ID
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              6202442690@jio
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-white/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
              WhatsApp for Payment Confirmation
            </p>
            <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <MessageCircle className="size-5 text-emerald-600" />
              6202442690
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Pay via UPI → send screenshot on WhatsApp → subscription activated
              within minutes.
            </p>
          </div>
          <div className="rounded-xl border border-white/90 bg-white/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Available Plans
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="font-semibold text-slate-900">Solo</p>
                <p className="text-xs text-slate-500">1 teacher, 25 students</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="font-semibold text-slate-900">Pro</p>
                <p className="text-xs text-slate-500">3 teachers, 100 students</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="font-semibold text-slate-900">Center</p>
                <p className="text-xs text-slate-500">10 teachers, unlimited</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="font-semibold text-slate-900">White Label</p>
                <p className="text-xs text-slate-500">Custom branding, API</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/90 bg-white/85 shadow-soft">
        <CardHeader>
          <CardTitle>Download Mobile App</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-6 text-slate-600">
          <p>
            Download the Android APK and install it directly on your phone — no
            Play Store needed.
          </p>
          <a
            href="/downloads/tuitiontrack.apk"
            download="TuitionTrack.apk"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Smartphone className="size-4" />
            Download APK (v1.1.0)
          </a>
          <p className="text-xs text-slate-400">
            After download, open the APK file on your Android device to install.
            You may need to allow &quot;Install from unknown sources&quot; in
            your phone settings.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/90 bg-white/85 shadow-soft">
          <CardHeader>
            <CardTitle>Students linked</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{data.studentsCount}</CardContent>
        </Card>
        <Card className="border-white/90 bg-white/85 shadow-soft">
          <CardHeader>
            <CardTitle>Parent emails mapped</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{data.mappedParentEmails}</CardContent>
        </Card>
        <Card className="border-white/90 bg-white/85 shadow-soft">
          <CardHeader>
            <CardTitle>Student emails mapped</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{data.mappedStudentEmails}</CardContent>
        </Card>
      </div>

      <Card className="border-emerald-200 bg-emerald-50 shadow-soft">
        <CardHeader>
          <CardTitle>Free AI providers</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-emerald-900">
          <p>You don&apos;t need a paid subscription to use AI features. Connect one of these free providers in AI Settings:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li><strong>OpenRouter</strong> — free Gemini Flash model behind one key</li>
            <li><strong>Google Gemini</strong> — free tier with 15 RPM</li>
            <li><strong>Groq</strong> — ultra-fast free inference</li>
            <li><strong>HuggingFace</strong> — free model router</li>
          </ul>
          <p className="mt-2">Paid options: OpenAI, Anthropic, Together AI.</p>
        </CardContent>
      </Card>

      <AiSettings />
      <Card className="border-white/90 bg-white/85 shadow-soft">
        <CardHeader>
          <CardTitle>Portal access mapping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-6 text-slate-600">
          <p>Teachers can manage every module.</p>
          <p>Parents are mapped through the `parent_email` saved on each student record.</p>
          <p>Students are mapped through the `student_email` saved on each student record.</p>
        </CardContent>
      </Card>

      <DeleteAccountCard />
    </div>
  );
}

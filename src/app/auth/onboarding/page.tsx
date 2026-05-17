import { redirect } from "next/navigation";
import { completeOnboardingAction } from "@/actions/portal";
import { getAuthContext } from "@/lib/auth";
import { Brand } from "@/components/brand";
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

export default async function OnboardingPage() {
  const context = await getAuthContext();

  if (!context.configured) {
    redirect("/login");
  }

  if (!context.user) {
    redirect("/login");
  }

  if (context.profile?.name) {
    redirect("/app/dashboard");
  }

  if (context.role !== "teacher") {
    redirect("/app/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-xl border-white/90 bg-white/92 shadow-soft">
        <CardHeader className="space-y-4">
          <Brand />
          <div className="space-y-2">
            <CardTitle className="text-3xl">Finish teacher onboarding</CardTitle>
            <CardDescription className="leading-6">
              Add your display name to activate the TuitionTrack teacher workspace. Parent and
              student accounts use read-only access and do not need this step.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form action={completeOnboardingAction} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" name="name" placeholder="Aarav Mehta" required />
            </div>
            <Button type="submit">Enter dashboard</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

import { requireAuthContext } from "@/lib/auth";
import { getSettingsPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const context = await requireAuthContext();
  const data = await getSettingsPageData(context);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage profile details and confirm how portal access is mapped to student records."
      />
      <ProfileForm
        initialName={data.profile?.name ?? ""}
        email={data.profile?.email ?? context.user?.email ?? ""}
        role={context.role!}
      />
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
    </div>
  );
}

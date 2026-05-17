import { redirect } from "next/navigation";
import { canAccessRoute } from "@/lib/constants";
import { requireAuthContext } from "@/lib/auth";
import { getReportsPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { MarksChart } from "@/components/tests/marks-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function ReportsPage() {
  const context = await requireAuthContext();
  if (!canAccessRoute(context.role, "/app/reports")) {
    redirect("/app/dashboard");
  }

  const data = await getReportsPageData(context);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Review attendance, marks, homework, and fee health with student-level summaries."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.summaries.slice(0, 4).map((summary) => (
          <Card key={summary.student_id} className="border-white/90 bg-white/85 shadow-soft">
            <CardHeader>
              <CardTitle className="text-lg">{summary.student_name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <div>Class: {summary.class_name}</div>
              <div>Attendance: {summary.attendance_percent}%</div>
              <div>Average marks: {summary.average_marks}%</div>
              <div>Pending homework: {summary.pending_homework}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <MarksChart title="Report view: average marks by subject" data={data.marksChart} />
      <Card className="border-white/90 bg-white/85 shadow-soft">
        <CardHeader>
          <CardTitle>Student progress summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Attendance %</TableHead>
                <TableHead>Average marks</TableHead>
                <TableHead>Pending homework</TableHead>
                <TableHead>Pending fees</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.summaries.map((summary) => (
                <TableRow key={summary.student_id}>
                  <TableCell>
                    {summary.student_name} · {summary.class_name}
                  </TableCell>
                  <TableCell>{summary.attendance_percent}%</TableCell>
                  <TableCell>{summary.average_marks}%</TableCell>
                  <TableCell>{summary.pending_homework}</TableCell>
                  <TableCell>{summary.pending_fees}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

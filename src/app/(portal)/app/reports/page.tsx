import { redirect } from "next/navigation";
import { CheckCircle2Icon, ClockIcon, AlertCircleIcon } from "lucide-react";
import { canAccessRoute } from "@/lib/constants";
import { requireAuthContext } from "@/lib/auth";
import { getReportsPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { MarksChart } from "@/components/tests/marks-chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportGenerator } from "@/components/reports/report-generator";
import { Badge } from "@/components/ui/badge";

export default async function ReportsPage() {
  const context = await requireAuthContext();
  if (!canAccessRoute(context.role, "/app/reports")) {
    redirect("/app/dashboard");
  }

  const data = await getReportsPageData(context);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & AI Intelligence"
        description="Review student performance summaries and generate AI-driven parent progress reports."
      />

      {context.role === "teacher" && (
        <ReportGenerator students={context.accessibleStudents} />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="border-white/90 bg-white/85 shadow-soft">
            <CardHeader>
              <CardTitle>Recent AI Reports</CardTitle>
              <CardDescription>Latest generated reports and their delivery status.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Generated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentReports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                        No reports generated yet. Use the generator above to start.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.recentReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">{report.student_name}</TableCell>
                        <TableCell>{report.subject || "General"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {report.status === "sent" ? (
                              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                <CheckCircle2Icon className="mr-1 size-3" />
                                Sent
                              </Badge>
                            ) : report.status === "draft" ? (
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                <ClockIcon className="mr-1 size-3" />
                                Draft
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                                <AlertCircleIcon className="mr-1 size-3" />
                                Failed
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {new Date(report.created_at).toLocaleDateString("en-IN")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card className="border-white/90 bg-white/85 shadow-soft">
            <CardHeader>
              <CardTitle>Intelligence Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">At-Risk Students</span>
                <Badge variant={data.atRiskCount > 0 ? "destructive" : "outline"}>
                  {data.atRiskCount}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Reports Sent (All Time)</span>
                <span className="font-semibold">{data.recentReports.filter(r => r.status === 'sent').length}</span>
              </div>
            </CardContent>
          </Card>

          <MarksChart title="Avg. marks by subject" data={data.marksChart} />
        </div>
      </div>

      <Card className="border-white/90 bg-white/85 shadow-soft">
        <CardHeader>
          <CardTitle>Student performance snapshot</CardTitle>
          <CardDescription>Aggregated metrics across all visible students.</CardDescription>
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

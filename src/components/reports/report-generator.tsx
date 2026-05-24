"use client";

import { useState, useTransition } from "react";
import { SparklesIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import { generateReportAction, sendReportAction } from "@/actions/portal";
import type { StudentRow } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ReportGenerator({ students }: { students: StudentRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [studentId, setStudentId] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [notes, setNotes] = useState<string>("");
  const [generatedReport, setGeneratedReport] = useState<{ id: string; content: string } | null>(null);

  const handleGenerate = () => {
    if (!studentId) {
      toast.error("Please select a student.");
      return;
    }

    startTransition(async () => {
      const result = await generateReportAction({
        student_id: studentId,
        subject: subject || undefined,
        language,
        tutor_notes: notes || undefined,
      });

      if (result.success && result.report) {
        setGeneratedReport(result.report);
        toast.success("AI report generated successfully.");
      } else {
        toast.error(result.message || "Failed to generate report.");
      }
    });
  };

  const handleSend = () => {
    if (!generatedReport) return;

    startTransition(async () => {
      const result = await sendReportAction(generatedReport.id);
      if (result.success) {
        toast.success("Report sent to parent.");
        setGeneratedReport(null);
        setStudentId("");
        setNotes("");
      } else {
        toast.error(result.message || "Failed to send report.");
      }
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SparklesIcon className="size-5 text-blue-600" />
            AI Report Generator
          </CardTitle>
          <CardDescription>
            Generate personalized progress reports using student performance data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="student">Select Student</Label>
            <Select value={studentId} onValueChange={(val) => setStudentId(val ?? "")}>
              <SelectTrigger id="student">
                <SelectValue placeholder="Choose a student" />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.class})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject (Optional)</Label>
              <Input 
                id="subject" 
                placeholder="e.g. Mathematics" 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "hi")}>
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes for AI</Label>
            <Textarea 
              id="notes" 
              placeholder="Mention specific strengths or behavior..." 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <Button 
            className="w-full" 
            onClick={handleGenerate} 
            disabled={isPending || !studentId}
          >
            {isPending ? "Generating..." : "Generate AI Report"}
          </Button>
        </CardContent>
      </Card>

      {generatedReport && (
        <Card className="border-blue-100 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="text-lg">Generated Preview</CardTitle>
            <CardDescription>
              Review and approve the AI-generated report before sending.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-blue-100 bg-white p-4 text-sm leading-relaxed text-slate-700 shadow-sm">
              <Textarea 
                value={generatedReport.content} 
                onChange={(e) => setGeneratedReport({...generatedReport, content: e.target.value})}
                rows={10}
                className="border-none p-0 focus-visible:ring-0 shadow-none resize-none"
              />
            </div>
            <Button className="w-full" onClick={handleSend} disabled={isPending}>
              <SendIcon className="mr-2 size-4" />
              {isPending ? "Sending..." : "Approve and Send to Parent"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Simple Input component if not available, otherwise import it.
import { Input } from "@/components/ui/input";

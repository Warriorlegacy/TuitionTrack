"use client";

import { useMemo, useState, useTransition } from "react";
import { PencilLineIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { StudentRow } from "@/lib/db/types";
import type { ChartDatum, TestItem } from "@/lib/queries";
import { deleteTestAction } from "@/actions/portal";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { usePortalFiltersStore } from "@/stores/use-portal-filters";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MarksChart } from "@/components/tests/marks-chart";
import { TestFormDialog } from "@/components/tests/test-form-dialog";

export function TestsPanel({
  students,
  tests,
  marksChart,
  canManage,
}: {
  students: StudentRow[];
  tests: TestItem[];
  marksChart: ChartDatum[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<TestItem | null>(null);
  const testSearch = usePortalFiltersStore((store) => store.testSearch);
  const setTestSearch = usePortalFiltersStore((store) => store.setTestSearch);

  useRealtimeRefresh(["tests"]);

  const filteredTests = useMemo(() => {
    const query = testSearch.trim().toLowerCase();
    if (!query) return tests;
    return tests.filter((test) =>
      [test.subject, test.student_name, test.student_class].join(" ").toLowerCase().includes(query),
    );
  }, [testSearch, tests]);

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteTestAction(id);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <MarksChart title="Performance by subject" data={marksChart} />
      <Card className="border-white/90 bg-white/85 shadow-soft">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Test records</CardTitle>
          <div className="flex flex-col gap-3 lg:flex-row">
            <Input
              value={testSearch}
              onChange={(event) => setTestSearch(event.target.value)}
              placeholder="Search by subject or student"
              className="lg:w-[260px]"
            />
            {canManage ? (
              <Button
                onClick={() => {
                  setEditingTest(null);
                  setDialogOpen(true);
                }}
              >
                <PlusIcon />
                Add marks
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {filteredTests.length === 0 ? (
            <Empty className="border border-dashed border-slate-200 bg-slate-50">
              <EmptyHeader>
                <EmptyTitle>No test records</EmptyTitle>
                <EmptyDescription>
                  {canManage
                    ? "Add test marks to start tracking student performance."
                    : "No tests are visible for this portal account yet."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Date</TableHead>
                  {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTests.map((test) => (
                  <TableRow key={test.id}>
                    <TableCell className="font-medium">{test.subject}</TableCell>
                    <TableCell>
                      {test.student_name} · {test.student_class}
                    </TableCell>
                    <TableCell>
                      {test.marks}/{test.total} ({test.percentage}%)
                    </TableCell>
                    <TableCell>{formatDate(test.date)}</TableCell>
                    {canManage ? (
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => {
                              setEditingTest(test);
                              setDialogOpen(true);
                            }}
                          >
                            <PencilLineIcon />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            disabled={isPending}
                            onClick={() => handleDelete(test.id)}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <TestFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          students={students}
          initialData={editingTest}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

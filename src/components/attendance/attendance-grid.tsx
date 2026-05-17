"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { AttendanceRow, StudentRow } from "@/lib/db/types";
import { saveAttendanceAction } from "@/actions/portal";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { usePortalFiltersStore } from "@/stores/use-portal-filters";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function AttendanceGrid({
  students,
  attendance,
  canManage,
}: {
  students: StudentRow[];
  attendance: AttendanceRow[];
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const attendanceDate = usePortalFiltersStore((store) => store.attendanceDate);
  const setAttendanceDate = usePortalFiltersStore((store) => store.setAttendanceDate);
  const initialEntries = useMemo(
    () =>
      students.map((student) => ({
        student_id: student.id,
        present:
          attendance.find(
            (record) => record.student_id === student.id && record.date === attendanceDate,
          )?.present ?? true,
      })),
    [attendance, attendanceDate, students],
  );

  const [entries, setEntries] = useState(initialEntries);

  useRealtimeRefresh(["attendance"]);

  const historyRows = useMemo(
    () =>
      attendance
        .map((record) => ({
          ...record,
          student_name: students.find((student) => student.id === record.student_id)?.name ?? "Student",
        }))
        .sort((a, b) => +new Date(b.date) - +new Date(a.date))
        .slice(0, 24),
    [attendance, students],
  );

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveAttendanceAction({
        date: attendanceDate,
        entries,
      });

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="border-white/90 bg-white/85 shadow-soft">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>{canManage ? "Daily attendance" : "Attendance overview"}</CardTitle>
          <Input
            type="date"
            className="w-full lg:w-[220px]"
            value={attendanceDate}
            onChange={(event) => {
              setAttendanceDate(event.target.value);
              setEntries(
                students.map((student) => ({
                  student_id: student.id,
                  present:
                    attendance.find(
                      (record) =>
                        record.student_id === student.id && record.date === event.target.value,
                    )?.present ?? true,
                })),
              );
            }}
          />
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <Empty className="border border-dashed border-slate-200 bg-slate-50">
              <EmptyHeader>
                <EmptyTitle>No students available</EmptyTitle>
                <EmptyDescription>
                  Add students first to start tracking daily attendance.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => {
                const student = students.find((item) => item.id === entry.student_id);
                return (
                  <div
                    key={entry.student_id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-slate-950">{student?.name}</p>
                      <p className="text-sm text-slate-500">{student?.class}</p>
                    </div>
                    {canManage ? (
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={entry.present}
                          onChange={(event) =>
                            setEntries((current) =>
                              current.map((item) =>
                                item.student_id === entry.student_id
                                  ? { ...item, present: event.target.checked }
                                  : item,
                              ),
                            )
                          }
                        />
                        Present
                      </label>
                    ) : (
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {attendance.find(
                          (record) =>
                            record.student_id === entry.student_id && record.date === attendanceDate,
                        )?.present
                          ? "Present"
                          : "Absent"}
                      </span>
                    )}
                  </div>
                );
              })}

              {canManage ? (
                <div className="flex justify-end">
                  <Button disabled={isPending} onClick={handleSave}>
                    Save attendance
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/90 bg-white/85 shadow-soft">
        <CardHeader>
          <CardTitle>Attendance history</CardTitle>
        </CardHeader>
        <CardContent>
          {historyRows.length === 0 ? (
            <Empty className="border border-dashed border-slate-200 bg-slate-50">
              <EmptyHeader>
                <EmptyTitle>No attendance history</EmptyTitle>
                <EmptyDescription>
                  Attendance entries will appear here once classes are marked.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatDate(row.date)}</TableCell>
                    <TableCell>{row.student_name}</TableCell>
                    <TableCell>{row.present ? "Present" : "Absent"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

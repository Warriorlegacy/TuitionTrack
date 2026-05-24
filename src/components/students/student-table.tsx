"use client";

import { useMemo, useState, useTransition } from "react";
import { PencilLineIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { StudentRow, AppRole } from "@/lib/db/types";
import { deleteStudentAction, assignUserRoleAction } from "@/actions/portal";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { usePortalFiltersStore } from "@/stores/use-portal-filters";
import { roleLabels } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StudentFormDialog } from "@/components/students/student-form-dialog";

export function StudentTable({
  students,
  roleMap,
  riskMap,
  canManage,
}: {
  students: StudentRow[];
  roleMap: Record<string, string>;
  riskMap?: Record<string, 'low' | 'medium' | 'high' | null>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const studentSearch = usePortalFiltersStore((store) => store.studentSearch);
  const setStudentSearch = usePortalFiltersStore((store) => store.setStudentSearch);

  useRealtimeRefresh(["students"]);

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) =>
      [student.name, student.class, student.parent_name, student.parent_phone]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [studentSearch, students]);

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteStudentAction(id);
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.refresh();
    });
  };

  return (
    <Card className="border-white/90 bg-white/85 shadow-soft">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <CardTitle>Student records</CardTitle>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-[260px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
              className="pl-9"
              placeholder="Search students"
            />
          </div>
          {canManage ? (
            <Button
              onClick={() => {
                setEditingStudent(null);
                setDialogOpen(true);
              }}
            >
              <PlusIcon />
              Add student
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {filteredStudents.length === 0 ? (
          <Empty className="border border-dashed border-slate-200 bg-slate-50">
            <EmptyHeader>
              <EmptyTitle>No students found</EmptyTitle>
              <EmptyDescription>
                {canManage
                  ? "Create your first student record to start assigning homework and tracking progress."
                  : "No student records are mapped to this portal yet."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Portal access</TableHead>
                  {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {student.name}
                        {riskMap && riskMap[student.id] && riskMap[student.id] !== 'low' && (
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "h-5 px-1.5 text-[10px] uppercase tracking-wider",
                              riskMap[student.id] === 'high' ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"
                            )}
                          >
                            {riskMap[student.id]} Risk
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{student.class}</TableCell>
                    <TableCell>
                      <div>
                        <p>{student.parent_name}</p>
                        <p className="text-xs text-slate-500">{student.parent_phone}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col gap-2">
                        {[
                          { email: student.parent_email, role: "parent" as AppRole, label: "Parent" },
                          { email: student.student_email, role: "student" as AppRole, label: "Student" },
                        ].map((access) => {
                          if (!access.email) return null;
                          const currentRole = roleMap[access.email.toLowerCase()];
                          const isCorrect = currentRole === access.role;

                          return (
                            <div key={access.email} className="flex flex-col gap-1.5 border-l-2 border-slate-100 pl-3">
                              <p className="text-xs font-medium text-slate-900">{access.label} Access</p>
                              <p className="text-xs text-slate-500 truncate max-w-[180px]">{access.email}</p>
                              <div className="flex items-center gap-2">
                                {currentRole ? (
                                  <Badge 
                                    variant={isCorrect ? "outline" : "destructive"} 
                                    className={cn(
                                      "h-5 px-1.5 text-[10px] uppercase tracking-wider",
                                      isCorrect ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""
                                    )}
                                  >
                                    {isCorrect ? `${roleLabels[currentRole]} OK` : `Incorrect: ${roleLabels[currentRole as AppRole]}`}
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] text-slate-400">Account not created</span>
                                )}
                                
                                {canManage && currentRole && !isCorrect ? (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-5 px-1.5 text-[10px] text-primary hover:bg-primary/5 font-semibold"
                                    disabled={isPending}
                                    onClick={() => {
                                      startTransition(async () => {
                                        const result = await assignUserRoleAction(access.email!, access.role);
                                        if (result.success) {
                                          toast.success(result.message);
                                          router.refresh();
                                        } else {
                                          toast.error(result.message);
                                        }
                                      });
                                    }}
                                  >
                                    Assign as {access.label}
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => {
                              setEditingStudent(student);
                              setDialogOpen(true);
                            }}
                          >
                            <PencilLineIcon />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            disabled={isPending}
                            onClick={() => handleDelete(student.id)}
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
          </div>
        )}
      </CardContent>
      {canManage ? (
        <StudentFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initialData={editingStudent}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </Card>
  );
}

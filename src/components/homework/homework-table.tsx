"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CheckCheckIcon,
  PencilLineIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { StudentRow } from "@/lib/db/types";
import type { HomeworkItem } from "@/lib/queries";
import {
  deleteHomeworkAction,
  toggleHomeworkStatusAction,
} from "@/actions/portal";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { usePortalFiltersStore } from "@/stores/use-portal-filters";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HomeworkFormDialog } from "@/components/homework/homework-form-dialog";

export function HomeworkTable({
  students,
  homework,
  canManage,
}: {
  students: StudentRow[];
  homework: HomeworkItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<HomeworkItem | null>(null);
  const homeworkSearch = usePortalFiltersStore((store) => store.homeworkSearch);
  const homeworkStatus = usePortalFiltersStore((store) => store.homeworkStatus);
  const setHomeworkSearch = usePortalFiltersStore((store) => store.setHomeworkSearch);
  const setHomeworkStatus = usePortalFiltersStore((store) => store.setHomeworkStatus);

  useRealtimeRefresh(["homework"]);

  const filteredHomework = useMemo(() => {
    const query = homeworkSearch.trim().toLowerCase();
    return homework.filter((item) => {
      const matchesQuery = query
        ? [item.title, item.student_name, item.student_class, item.description ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(query)
        : true;
      const matchesStatus = homeworkStatus === "all" ? true : item.status === homeworkStatus;
      return matchesQuery && matchesStatus;
    });
  }, [homework, homeworkSearch, homeworkStatus]);

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteHomeworkAction(id);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  };

  const handleToggle = (item: HomeworkItem) => {
    startTransition(async () => {
      const result = await toggleHomeworkStatusAction(
        item.id,
        item.status === "pending" ? "completed" : "pending",
      );
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
        <CardTitle>Homework tracker</CardTitle>
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative min-w-[250px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              value={homeworkSearch}
              onChange={(event) => setHomeworkSearch(event.target.value)}
              placeholder="Search homework"
            />
          </div>
          <select
            value={homeworkStatus}
            onChange={(event) =>
              setHomeworkStatus(event.target.value as "all" | "pending" | "completed")
            }
            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
          {canManage ? (
            <Button
              onClick={() => {
                setEditingHomework(null);
                setDialogOpen(true);
              }}
            >
              <PlusIcon />
              Assign homework
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {filteredHomework.length === 0 ? (
          <Empty className="border border-dashed border-slate-200 bg-slate-50">
            <EmptyHeader>
              <EmptyTitle>No homework records</EmptyTitle>
              <EmptyDescription>
                {canManage
                  ? "Assign homework to students and track completion here."
                  : "There are no homework records visible for this login yet."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHomework.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.student_name} · {item.student_class}
                    </TableCell>
                    <TableCell>{formatDate(item.due_date)}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === "completed" ? "secondary" : "default"}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="icon-sm" onClick={() => handleToggle(item)}>
                            <CheckCheckIcon />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => {
                              setEditingHomework(item);
                              setDialogOpen(true);
                            }}
                          >
                            <PencilLineIcon />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            disabled={isPending}
                            onClick={() => handleDelete(item.id)}
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
        <HomeworkFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          students={students}
          initialData={editingHomework}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </Card>
  );
}

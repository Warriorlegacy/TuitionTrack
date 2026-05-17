"use client";

import { useMemo, useState, useTransition } from "react";
import { PencilLineIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { StudentRow } from "@/lib/db/types";
import type { FeeItem } from "@/lib/queries";
import { deleteFeeAction } from "@/actions/portal";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { usePortalFiltersStore } from "@/stores/use-portal-filters";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FeeFormDialog } from "@/components/fees/fee-form-dialog";

export function FeeTable({
  students,
  fees,
  canManage,
}: {
  students: StudentRow[];
  fees: FeeItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<FeeItem | null>(null);
  const feeStatus = usePortalFiltersStore((store) => store.feeStatus);
  const setFeeStatus = usePortalFiltersStore((store) => store.setFeeStatus);

  useRealtimeRefresh(["fees"]);

  const filteredFees = useMemo(
    () => (feeStatus === "all" ? fees : fees.filter((fee) => fee.status === feeStatus)),
    [feeStatus, fees],
  );

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteFeeAction(id);
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
        <CardTitle>Fee tracker</CardTitle>
        <div className="flex flex-col gap-3 lg:flex-row">
          <select
            value={feeStatus}
            onChange={(event) =>
              setFeeStatus(event.target.value as "all" | "paid" | "unpaid" | "overdue")
            }
            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="all">All fees</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="overdue">Overdue</option>
          </select>
          {canManage ? (
            <Button
              onClick={() => {
                setEditingFee(null);
                setDialogOpen(true);
              }}
            >
              <PlusIcon />
              Add fee
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {filteredFees.length === 0 ? (
          <Empty className="border border-dashed border-slate-200 bg-slate-50">
            <EmptyHeader>
              <EmptyTitle>No fee records</EmptyTitle>
              <EmptyDescription>
                {canManage ? "Create fee records to start tracking collections." : "No fee data is visible for this portal yet."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Status</TableHead>
                {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFees.map((fee) => (
                <TableRow key={fee.id}>
                  <TableCell>
                    {fee.student_name} · {fee.student_class}
                  </TableCell>
                  <TableCell>{formatCurrency(fee.amount)}</TableCell>
                  <TableCell>{formatDate(fee.due_date)}</TableCell>
                  <TableCell>
                    <Badge variant={fee.status === "paid" ? "secondary" : "default"}>
                      {fee.status}
                    </Badge>
                  </TableCell>
                  {canManage ? (
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => {
                            setEditingFee(fee);
                            setDialogOpen(true);
                          }}
                        >
                          <PencilLineIcon />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          disabled={isPending}
                          onClick={() => handleDelete(fee.id)}
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
      {canManage ? (
        <FeeFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          students={students}
          initialData={editingFee}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </Card>
  );
}

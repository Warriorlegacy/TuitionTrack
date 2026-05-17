import type { RecentActivityItem } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export function RecentActivity({ items }: { items: RecentActivityItem[] }) {
  return (
    <Card className="border-white/90 bg-white/85 shadow-soft">
      <CardHeader>
        <CardDescription>Recent activity</CardDescription>
        <CardTitle>Latest updates across the workspace</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <Empty className="border border-dashed border-slate-200 bg-slate-50">
            <EmptyHeader>
              <EmptyTitle>No activity yet</EmptyTitle>
              <EmptyDescription>
                New homework, tests, fees, and announcements will appear here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold capitalize text-slate-950">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    {formatDate(item.created_at, "dd MMM")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

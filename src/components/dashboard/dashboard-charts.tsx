"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import type { ChartDatum } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export function DashboardCharts({
  marksChart,
  feeChart,
}: {
  marksChart: ChartDatum[];
  feeChart: ChartDatum[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="border-white/90 bg-white/85 shadow-soft">
        <CardHeader>
          <CardTitle>Subject performance</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {marksChart.length === 0 ? (
            <Empty className="h-full border border-dashed border-slate-200 bg-slate-50">
              <EmptyHeader>
                <EmptyTitle>No marks data yet</EmptyTitle>
                <EmptyDescription>
                  Add a few test records to see subject-wise average performance.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marksChart}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/90 bg-white/85 shadow-soft">
        <CardHeader>
          <CardTitle>Fees overview</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {feeChart.every((entry) => entry.value === 0) ? (
            <Empty className="h-full border border-dashed border-slate-200 bg-slate-50">
              <EmptyHeader>
                <EmptyTitle>No fee records yet</EmptyTitle>
                <EmptyDescription>
                  Create fee entries to monitor paid, unpaid, and overdue balances.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={feeChart}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={96}
                  fill="#60a5fa"
                  label
                />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

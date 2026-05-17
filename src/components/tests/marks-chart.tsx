"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import type { ChartDatum } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export function MarksChart({
  title,
  data,
}: {
  title: string;
  data: ChartDatum[];
}) {
  return (
    <Card className="border-white/90 bg-white/85 shadow-soft">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? (
          <Empty className="h-full border border-dashed border-slate-200 bg-slate-50">
            <EmptyHeader>
              <EmptyTitle>No chart data yet</EmptyTitle>
              <EmptyDescription>
                Add test scores to generate a live performance chart.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

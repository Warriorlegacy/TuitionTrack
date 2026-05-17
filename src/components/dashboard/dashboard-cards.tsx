import type { DashboardStat } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DashboardCards({ stats }: { stats: DashboardStat[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-white/90 bg-white/85 shadow-soft">
          <CardHeader className="space-y-2">
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <CardTitle className="text-3xl font-semibold">{stat.value}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">{stat.helper}</CardContent>
        </Card>
      ))}
    </div>
  );
}

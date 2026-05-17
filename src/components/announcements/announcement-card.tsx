import type { AnnouncementRow } from "@/lib/db/types";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AnnouncementCard({ announcement }: { announcement: AnnouncementRow }) {
  return (
    <Card className="border-white/90 bg-white/85 shadow-soft">
      <CardHeader className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {formatDate(announcement.created_at, "dd MMM yyyy")}
        </p>
        <CardTitle>{announcement.title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm leading-6 text-slate-600">
        {announcement.message}
      </CardContent>
    </Card>
  );
}

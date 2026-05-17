"use client";

import { useMemo, useState, useTransition } from "react";
import { PencilLineIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AnnouncementRow } from "@/lib/db/types";
import { deleteAnnouncementAction } from "@/actions/portal";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { usePortalFiltersStore } from "@/stores/use-portal-filters";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { AnnouncementCard } from "@/components/announcements/announcement-card";
import { AnnouncementFormDialog } from "@/components/announcements/announcement-form-dialog";

export function AnnouncementsPanel({
  announcements,
  canManage,
}: {
  announcements: AnnouncementRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementRow | null>(null);
  const announcementSearch = usePortalFiltersStore((store) => store.announcementSearch);
  const setAnnouncementSearch = usePortalFiltersStore((store) => store.setAnnouncementSearch);

  useRealtimeRefresh(["announcements"]);

  const filteredAnnouncements = useMemo(() => {
    const query = announcementSearch.trim().toLowerCase();
    if (!query) return announcements;
    return announcements.filter((announcement) =>
      [announcement.title, announcement.message].join(" ").toLowerCase().includes(query),
    );
  }, [announcementSearch, announcements]);

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteAnnouncementAction(id);
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Input
          value={announcementSearch}
          onChange={(event) => setAnnouncementSearch(event.target.value)}
          placeholder="Search announcements"
          className="lg:w-[300px]"
        />
        {canManage ? (
          <Button
            onClick={() => {
              setEditingAnnouncement(null);
              setDialogOpen(true);
            }}
          >
            <PlusIcon />
            Broadcast message
          </Button>
        ) : null}
      </div>

      {filteredAnnouncements.length === 0 ? (
        <Empty className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 py-12">
          <EmptyHeader>
            <EmptyTitle>No announcements</EmptyTitle>
            <EmptyDescription>
              {canManage
                ? "Create a broadcast to share updates with parents."
                : "Announcements shared by your teacher will appear here."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          {filteredAnnouncements.map((announcement) => (
            <div key={announcement.id} className="space-y-3">
              <AnnouncementCard announcement={announcement} />
              {canManage ? (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => {
                      setEditingAnnouncement(announcement);
                      setDialogOpen(true);
                    }}
                  >
                    <PencilLineIcon />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={isPending}
                    onClick={() => handleDelete(announcement.id)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {canManage ? (
        <AnnouncementFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initialData={editingAnnouncement}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

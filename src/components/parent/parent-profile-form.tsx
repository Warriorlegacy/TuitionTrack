"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateProfileAction } from "@/actions/portal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Self-service display-name edit for a parent/guardian account. */
export function ParentProfileForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);

  const handleSave = () => {
    startTransition(async () => {
      // ponytail: role arg is ignored server-side — profile edits can't change roles.
      const result = await updateProfileAction(name, "parent");
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  };

  return (
    <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-base">Edit profile</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 p-0 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="parent-display-name">Display name</Label>
          <Input
            id="parent-display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </div>
        <div className="flex items-end justify-end">
          <Button onClick={handleSave} disabled={isPending || !name.trim()}>
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

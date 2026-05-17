"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { AppRole } from "@/lib/db/types";
import { updateProfileAction } from "@/actions/portal";
import { roleLabels } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ProfileForm({
  initialName,
  email,
  role: initialRole,
}: {
  initialName: string;
  email: string;
  role: AppRole;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [role, setRole] = useState<AppRole>(initialRole);

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateProfileAction(name, role);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
    });
  };

  return (
    <Card className="border-white/90 bg-white/85 shadow-soft">
      <CardHeader>
        <CardTitle>Profile settings</CardTitle>
        <CardDescription>Manage the basic account details shown inside the portal.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="display-name">Display name</Label>
          <Input
            id="display-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} disabled />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="role">Designation</Label>
          <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
            <SelectTrigger id="role">
              <SelectValue placeholder="Select designation" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(roleLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end justify-end">
          <Button onClick={handleSave} disabled={isPending}>
            Save profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

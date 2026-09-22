"use client";

import { useState, useTransition } from "react";
import {
  UsersIcon,
  SearchIcon,
  GraduationCapIcon,
  BriefcaseIcon,
  ChevronDownIcon,
  ShieldAlertIcon,
  CheckIcon,
  Loader2Icon,
  CopyIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { TeacherAddMemberByCodeDialog } from "@/components/workspace/teacher-add-by-code-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateMemberRoleAction } from "@/actions/workspace-actions";
import type { WorkspaceMember, WorkspaceRole } from "@/lib/workspace/auth";

export function WorkspaceMembersTable({
  workspaceId,
  initialMembers,
  ownerId,
}: {
  workspaceId: string;
  initialMembers: WorkspaceMember[];
  ownerId: string;
}) {
  const [members, setMembers] = useState<WorkspaceMember[]>(initialMembers);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleRoleChange = (targetUserId: string, newRole: "student" | "parent" | "teacher") => {
    if (targetUserId === ownerId) {
      toast.error("Cannot change role of the workspace owner.");
      return;
    }

    setUpdatingUserId(targetUserId);
    startTransition(async () => {
      const result = await updateMemberRoleAction({
        workspaceId,
        targetUserId,
        newRole,
      });

      setUpdatingUserId(null);
      if (result.success) {
        setMembers((prev) =>
          prev.map((m) => (m.user_id === targetUserId ? { ...m, role: newRole as WorkspaceRole } : m))
        );
        toast.success(result.message);
      } else {
        toast.error(result.message || "Failed to update role.");
      }
    });
  };

  const filteredMembers = members.filter((m) => {
    const roleMatch = filterRole === "all" || m.role === filterRole;
    const searchLower = search.toLowerCase();
    const nameMatch = m.user?.name?.toLowerCase().includes(searchLower) ?? false;
    const emailMatch = m.user?.email?.toLowerCase().includes(searchLower) ?? false;
    return roleMatch && (search === "" || nameMatch || emailMatch);
  });

  const getRoleBadge = (role: string, isOwner: boolean) => {
    if (isOwner) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
          👑 Owner
        </span>
      );
    }
    if (role === "teacher" || role === "admin") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
          <BriefcaseIcon className="size-3" />
          Teacher
        </span>
      );
    }
    if (role === "parent") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
          <UsersIcon className="size-3" />
          Parent
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
        <GraduationCapIcon className="size-3" />
        Student
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters & Search & Add by Code */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-1">
            {["all", "student", "parent", "teacher"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setFilterRole(r)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                  filterRole === r
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {r === "all" ? `All (${members.length})` : r}
              </button>
            ))}
          </div>

          <TeacherAddMemberByCodeDialog buttonText="Add by Code" />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-soft">
        <Table>
          <TableHeader className="bg-slate-50/70">
            <TableRow>
              <TableHead className="w-[30%] font-semibold text-slate-700">Member</TableHead>
              <TableHead className="font-semibold text-slate-700">Current Role</TableHead>
              <TableHead className="font-semibold text-slate-700">Unique Code</TableHead>
              <TableHead className="font-semibold text-slate-700">Joined</TableHead>
              <TableHead className="font-semibold text-slate-700">Status</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-slate-500">
                  <UsersIcon className="mx-auto mb-2 size-8 text-slate-300" />
                  No members have joined this workspace yet.
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((member) => {
                const isOwner = member.user_id === ownerId;
                const isUpdating = updatingUserId === member.user_id;
                const memberCode = member.link_code || member.user?.link_code;

                return (
                  <TableRow key={member.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {member.user?.name || "Unnamed User"}
                        </p>
                        <p className="text-xs text-slate-500">{member.user?.email || "No email"}</p>
                      </div>
                    </TableCell>

                    <TableCell>{getRoleBadge(member.role, isOwner)}</TableCell>

                    <TableCell>
                      {memberCode ? (
                        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-700 bg-slate-100/90 border border-slate-200/80 px-2 py-0.5 rounded-md w-fit">
                          <span>{memberCode}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(memberCode);
                              toast.success(`Copied code: ${memberCode}`);
                            }}
                            className="text-slate-400 hover:text-slate-800 transition-colors"
                            title="Copy code"
                          >
                            <CopyIcon className="size-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {new Date(member.joined_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>

                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Active
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      {isOwner ? (
                        <span className="text-xs font-medium text-slate-400">Workspace Owner</span>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            disabled={isUpdating}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {isUpdating ? (
                              <Loader2Icon className="size-3.5 animate-spin" />
                            ) : (
                              <>
                                <span>Change Role</span>
                                <ChevronDownIcon className="size-3 text-slate-400" />
                              </>
                            )}
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-xs text-slate-500">
                              Assign Workspace Role
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => handleRoleChange(member.user_id, "student")}
                              className="flex items-center justify-between text-xs cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <GraduationCapIcon className="size-4 text-emerald-600" />
                                Student
                              </span>
                              {member.role === "student" && <CheckIcon className="size-3.5 text-emerald-600" />}
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => handleRoleChange(member.user_id, "parent")}
                              className="flex items-center justify-between text-xs cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <UsersIcon className="size-4 text-indigo-600" />
                                Parent / Guardian
                              </span>
                              {member.role === "parent" && <CheckIcon className="size-3.5 text-indigo-600" />}
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => handleRoleChange(member.user_id, "teacher")}
                              className="flex items-center justify-between text-xs cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <BriefcaseIcon className="size-4 text-purple-600" />
                                Teacher
                              </span>
                              {member.role === "teacher" && <CheckIcon className="size-3.5 text-purple-600" />}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-xs text-slate-600">
        <ShieldAlertIcon className="size-4 shrink-0 text-slate-400" />
        <span>
          Changing a member&apos;s role updates their permissions and redirects them to their new portal on their next session. Privilege escalation to Owner or Admin is restricted to maintain workspace integrity.
        </span>
      </div>
    </div>
  );
}

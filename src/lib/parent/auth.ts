import "server-only";

import { redirect } from "next/navigation";

import { getAuthContext, type AuthContext } from "@/lib/auth";
import type { AppRole, StudentRow } from "@/lib/db/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Parent-side identity resolution.
 *
 * The parent portal never trusts a student id supplied by the client. Every
 * child the portal renders is resolved from `guardian_student_relationships`
 * for the authenticated user, and the active child is validated against that
 * list before any data is read. A `?child=<uuid>` query parameter that does not
 * appear in this list is ignored, not honoured.
 *
 * See brief sections 62, 65, 104.
 */

export const PARENT_PERMISSIONS = [
  "view_academic_progress",
  "view_homework",
  "view_assignments",
  "view_test_results",
  "view_attendance",
  "view_portfolio",
  "view_reports",
  "view_fees",
  "receive_notifications",
  "message_teacher",
  "book_ptm",
] as const;

export type ParentPermission = (typeof PARENT_PERMISSIONS)[number];

export type LinkedChild = {
  student: StudentRow;
  relationshipId: string;
  relationshipType: "father" | "mother" | "guardian" | "other";
  verifiedAt: string | null;
};

export type ParentAuthContext = AuthContext & {
  /** Always at least one entry when `isParent` is true, else empty. */
  children: LinkedChild[];
  /** The active child, after validating the requested id against `children`. */
  activeChild: LinkedChild | null;
  /** Set when the caller holds the parent role. */
  isParent: boolean;
  /** Convenience: does the active child's guardian hold this permission? */
  can: (permission: ParentPermission) => boolean;
  /** Resolved permission map for the active child. */
  permissions: Record<ParentPermission, boolean>;
};

const ALL_FALSE = Object.fromEntries(
  PARENT_PERMISSIONS.map((p) => [p, false]),
) as Record<ParentPermission, boolean>;

/**
 * Resolve every child this guardian may see, together with the permission map
 * for each. Reads run through the request-scoped client, so RLS applies on top
 * of the explicit relationship filter — two independent checks rather than one.
 */
async function resolveChildren(userId: string): Promise<LinkedChild[]> {
  const supabase = createSupabaseServerClient();

  const { data: rels, error } = await supabase
    .from("guardian_student_relationships")
    .select(
      "id, student_id, relationship_type, status, verified_at, student:students(*)",
    )
    .eq("guardian_user_id", userId)
    .eq("status", "active")
    .not("verified_at", "is", null)
    .order("created_at", { ascending: true });

  if (error || !rels) return [];

  return rels
    .map((row) => {
      const r = row as unknown as {
        id: string;
        student_id: string;
        relationship_type: LinkedChild["relationshipType"];
        verified_at: string | null;
        student: StudentRow | null;
      };
      if (!r.student) return null;
      return {
        student: r.student,
        relationshipId: r.id,
        relationshipType: r.relationship_type,
        verifiedAt: r.verified_at,
      } satisfies LinkedChild;
    })
    .filter((c): c is LinkedChild => c !== null);
}

async function resolvePermissions(relationshipId: string): Promise<Record<ParentPermission, boolean>> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("parent_permissions")
    .select("permission, allowed")
    .eq("relationship_id", relationshipId);

  const explicit = new Map<string, boolean>();
  (data ?? []).forEach((row) => {
    const r = row as { permission: string; allowed: boolean };
    explicit.set(r.permission, r.allowed);
  });

  // Mirrors `parent_has_permission` in SQL. Read-only visibility defaults on;
  // anything with an external side effect, and anything financial, defaults
  // off until a teacher deliberately grants it.
  const defaults: Record<ParentPermission, boolean> = {
    view_academic_progress: true,
    view_homework: true,
    view_assignments: true,
    view_test_results: true,
    view_attendance: true,
    view_reports: true,
    receive_notifications: true,
    view_portfolio: false,
    view_fees: false,
    message_teacher: false,
    book_ptm: false,
  };

  const resolved = { ...defaults };
  explicit.forEach((allowed, permission) => {
    if ((PARENT_PERMISSIONS as readonly string[]).includes(permission)) {
      resolved[permission as ParentPermission] = allowed;
    }
  });
  return resolved;
}

/**
 * Build the parent context. `requestedChildId`, when present, is validated
 * against the resolved child list; an unknown id falls back to the first child
 * rather than erroring, so a stale bookmark or a shared link degrades to
 * something usable instead of a 403.
 */
export async function getParentContext(requestedChildId?: string): Promise<ParentAuthContext> {
  const base = await getAuthContext();

  if (!base.user) {
    return {
      ...base,
      children: [],
      activeChild: null,
      isParent: false,
      can: () => false,
      permissions: ALL_FALSE,
    };
  }

  const children = await resolveChildren(base.user.id);

  // Choose the active child: requested id if (and only if) it is one of ours,
  // otherwise the first linked child. A tampered `?child=` therefore degrades
  // to the caller's own first child instead of erroring or leaking.
  const requested: LinkedChild | undefined =
    requestedChildId && children.find((c) => c.student.id === requestedChildId)
      ? children.find((c) => c.student.id === requestedChildId)
      : undefined;
  const activeChild: LinkedChild | null = requested ?? children[0] ?? null;

  const permissions = activeChild
    ? await resolvePermissions(activeChild.relationshipId)
    : ALL_FALSE;

  return {
    ...base,
    children,
    activeChild,
    isParent: children.length > 0 || base.role === "parent",
    can: (permission: ParentPermission) => permissions[permission] === true,
    permissions,
  };
}

/**
 * Parent context or redirect. Used by every `/parent/*` page so that a missing
 * session cannot reach a partially-rendered portal.
 */
export async function requireParentContext(
  requestedChildId?: string,
): Promise<ParentAuthContext> {
  const context = await getParentContext(requestedChildId);

  if (!context.user) {
    redirect("/login?next=/parent");
  }

  return context;
}

/** True when the caller holds a global role permitted to see admin surfaces. */
export function isStaffRole(role: AppRole | null): boolean {
  return role === "teacher";
}

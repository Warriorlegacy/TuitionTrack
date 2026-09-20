import type { GuardianRelationshipType } from "@/lib/db/types";

/**
 * Display labels for the parent portal.
 *
 * Deliberately separate from the database values: relationship types are stored
 * as a closed enum, and the UI must not invent values that the enum will reject.
 * Brief section 5 specifies exactly four options.
 */

export const ACCEPT_RELATIONSHIP_OPTIONS: {
  value: GuardianRelationshipType;
  label: string;
  helper: string;
}[] = [
  { value: "father", label: "Father", helper: "Paternal guardian" },
  { value: "mother", label: "Mother", helper: "Maternal guardian" },
  { value: "guardian", label: "Guardian", helper: "Legal or appointed guardian" },
  { value: "other", label: "Other", helper: "Another relationship" },
];

export function relationshipLabel(value: string | null | undefined): string {
  const found = ACCEPT_RELATIONSHIP_OPTIONS.find((o) => o.value === value);
  if (found) return found.label;
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Guardian";
}

/** Invite lifetimes offered in the UI, in plain language. */
export const INVITE_EXPIRY_OPTIONS = [
  { value: 24, label: "24 hours" },
  { value: 72, label: "3 days" },
  { value: 168, label: "7 days" },
  { value: 720, label: "30 days" },
] as const;

export type OrgRole = "owner" | "admin" | "member";

export const ASSIGNABLE_ROLES = ["admin", "member"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Owners and admins manage the team and settings; members work transactions. */
export function canManageTeam(role: string): boolean {
  return role === "owner" || role === "admin";
}

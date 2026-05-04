import type { PortalUser } from "@/lib/auth/portal-user";

export type AllowedRole = PortalUser["role"];

export class ForbiddenRoleError extends Error {
  readonly status = 403;
  readonly reason = "insufficient_role";

  constructor() {
    super("insufficient_role");
    this.name = "ForbiddenRoleError";
  }
}

export function isForbiddenRoleError(error: unknown): error is ForbiddenRoleError {
  return error instanceof ForbiddenRoleError;
}

export function requireRole(
  user: Pick<PortalUser, "role"> | null | undefined,
  allowedRoles: readonly AllowedRole[]
) {
  if (!user?.role || !allowedRoles.includes(user.role)) {
    throw new ForbiddenRoleError();
  }
}
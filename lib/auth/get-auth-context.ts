import {
  getCurrentPortalAuthContext,
  type PortalUser,
} from "@/lib/auth/portal-user";

export interface AuthContext {
  user: PortalUser;
  role: PortalUser["role"];
  userId: string;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const authContext = await getCurrentPortalAuthContext();

  if (!authContext) {
    return null;
  }

  return {
    user: authContext.portalUser,
    role: authContext.portalUser.role,
    userId: authContext.portalUser.id,
  };
}
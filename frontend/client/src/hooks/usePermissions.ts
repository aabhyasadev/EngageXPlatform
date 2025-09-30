import { useAuth } from "./useAuth";
import { hasPermission, hasAnyPermission, Permission, UserRole } from "@/lib/permissions";

/**
 * Hook for checking user permissions based on their role
 */
export function usePermissions() {
  const { user } = useAuth();
  
  const userRole = user?.role as UserRole;

  /**
   * Check if the current user has a specific permission
   */
  const checkPermission = (permission: Permission): boolean => {
    if (!userRole) return false;
    return hasPermission(userRole, permission);
  };

  /**
   * Check if the current user has any of the specified permissions
   */
  const checkAnyPermission = (permissions: Permission[]): boolean => {
    if (!userRole) return false;
    return hasAnyPermission(userRole, permissions);
  };

  /**
   * Check if the current user can read a specific feature
   */
  const canRead = (feature: string): boolean => {
    return checkPermission(`${feature}:read` as Permission);
  };

  /**
   * Check if the current user can write to a specific feature
   */
  const canWrite = (feature: string): boolean => {
    return checkPermission(`${feature}:write` as Permission);
  };

  return {
    userRole,
    checkPermission,
    checkAnyPermission,
    canRead,
    canWrite,
  };
}
import { ReactNode } from "react";
import { Permission } from "@/lib/permissions";
import { usePermissions } from "@/hooks/usePermissions";

interface PermissionRouteProps {
  children: ReactNode;
  permissions: Permission[];
  fallback?: ReactNode;
}

/**
 * Component that conditionally renders content based on user permissions
 * If user doesn't have required permissions, shows fallback or null
 */
export default function PermissionRoute({ 
  children, 
  permissions, 
  fallback = null 
}: PermissionRouteProps) {
  const { checkAnyPermission } = usePermissions();
  
  // Check if user has any of the required permissions
  const hasAccess = checkAnyPermission(permissions);
  
  if (!hasAccess) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}
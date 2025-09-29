/**
 * Role-based Access Control (RBAC) system for EngageX
 * Defines permissions for different user roles
 */

export type UserRole = 'admin' | 'organizer' | 'campaign_manager' | 'analyst' | 'editor';

export type Permission = 
  | 'dashboard'
  | 'contacts:read'
  | 'contacts:write'
  | 'campaigns:read'
  | 'campaigns:write'
  | 'templates:read'
  | 'templates:write'
  | 'domains:read'
  | 'domains:write'
  | 'analytics:read'
  | 'team:read'
  | 'team:write'
  | 'subscription:read'
  | 'subscription:write'
  | 'settings:read'
  | 'settings:write';

// Permission mapping for each role
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'dashboard',
    'contacts:read',
    'contacts:write',
    'campaigns:read',
    'campaigns:write',
    'templates:read',
    'templates:write',
    'domains:read',
    'domains:write',
    'analytics:read',
    'team:read',
    'team:write',
    'subscription:read',
    'subscription:write',
    'settings:read',
    'settings:write',
  ],
  organizer: [
    'dashboard',
    'contacts:read',
    'contacts:write',
    'campaigns:read',
    'campaigns:write',
    'templates:read',
    'templates:write',
    'domains:read',
    'domains:write',
    'analytics:read',
    'team:read',
    'team:write',
    'subscription:read',
    'subscription:write',
    'settings:read',
    'settings:write',
  ],
  campaign_manager: [
    'dashboard',
    'contacts:read',
    'contacts:write',
    'campaigns:read',
    'campaigns:write',
    'templates:read',
    'templates:write',
    'analytics:read',
  ],
  analyst: [
    'dashboard',
    'contacts:read',
    'campaigns:read',
    'templates:read',
    'analytics:read',
  ],
  editor: [
    'dashboard',
    'contacts:read',
    'templates:read',
    'templates:write',
  ],
};

/**
 * Check if a user role has a specific permission
 */
export function hasPermission(role: UserRole | string, permission: Permission): boolean {
  if (!role || !(role in ROLE_PERMISSIONS)) {
    return false;
  }
  
  return ROLE_PERMISSIONS[role as UserRole].includes(permission);
}

/**
 * Check if a user role has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole | string, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Get all permissions for a user role
 */
export function getRolePermissions(role: UserRole | string): Permission[] {
  if (!role || !(role in ROLE_PERMISSIONS)) {
    return [];
  }
  
  return ROLE_PERMISSIONS[role as UserRole];
}

/**
 * Navigation item configuration with required permissions
 */
export interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  permissions: Permission[];
  description?: string;
}

/**
 * Check if user can access a navigation item
 */
export function canAccessNavItem(role: UserRole | string, navItem: NavigationItem): boolean {
  return hasAnyPermission(role, navItem.permissions);
}
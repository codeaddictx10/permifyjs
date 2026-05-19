import type { AuthUser, AuthContext } from './types';
import type { AuthEngine } from './engine';

// ─── Read helpers ────────────────────────────────────────────────

export async function getRoles(
  auth: AuthEngine,
  user: AuthUser,
  context?: AuthContext
): Promise<string[]> {
  return auth.getRoles(user, context);
}

export async function getDirectPermissions(
  auth: AuthEngine,
  user: AuthUser,
  context?: AuthContext
): Promise<string[]> {
  return auth.getDirectPermissions(user, context);
}

export async function getPermissionsThroughRoles(
  auth: AuthEngine,
  user: AuthUser,
  context?: AuthContext
): Promise<string[]> {
  return auth.getPermissionsThroughRoles(user, context);
}

export async function getAllPermissions(
  auth: AuthEngine,
  user: AuthUser,
  context?: AuthContext
): Promise<string[]> {
  return auth.getAllPermissions(user, context);
}

export async function getRolePermissions(
  auth: AuthEngine,
  role: string,
  context?: AuthContext
): Promise<string[]> {
  return auth.getRolePermissions(role, context);
}

// ─── Role utilities ───────────────────────────────────────────────

export async function hasAnyRole(
  auth: AuthEngine,
  user: AuthUser,
  roles: string[],
  context?: AuthContext
): Promise<boolean> {
  const results = await Promise.all(
    roles.map((role) => auth.hasRole(user, role, context))
  );
  return results.some(Boolean);
}

export async function hasAllRoles(
  auth: AuthEngine,
  user: AuthUser,
  roles: string[],
  context?: AuthContext
): Promise<boolean> {
  const results = await Promise.all(
    roles.map((role) => auth.hasRole(user, role, context))
  );
  return results.every(Boolean);
}

export async function hasExactRoles(
  auth: AuthEngine,
  user: AuthUser,
  roles: string[],
  context?: AuthContext
): Promise<boolean> {
  return auth.hasExactRoles(user, roles, context);
}


// ─── Merged permission utilities (direct + role) ──────────────────

export async function hasAnyPermission(
  auth: AuthEngine,
  user: AuthUser,
  permissions: string[],
  context?: AuthContext
): Promise<boolean> {
  const results = await Promise.all(
    permissions.map((p) => auth.can(user, p, context))
  );
  return results.some(Boolean);
}

export async function hasAllPermissions(
  auth: AuthEngine,
  user: AuthUser,
  permissions: string[],
  context?: AuthContext
): Promise<boolean> {
  const results = await Promise.all(
    permissions.map((p) => auth.can(user, p, context))
  );
  return results.every(Boolean);
}

// ─── Direct permission utilities ──────────────────────────────────

export async function hasAnyDirectPermission(
  auth: AuthEngine,
  user: AuthUser,
  permissions: string[],
  context?: AuthContext
): Promise<boolean> {
  const results = await Promise.all(
    permissions.map((p) => auth.canDirectly(user, p, context))
  );
  return results.some(Boolean);
}

export async function hasAllDirectPermissions(
  auth: AuthEngine,
  user: AuthUser,
  permissions: string[],
  context?: AuthContext
): Promise<boolean> {
  const results = await Promise.all(
    permissions.map((p) => auth.canDirectly(user, p, context))
  );
  return results.every(Boolean);
}

// ─── Combined utilities ───────────────────────────────────────────

export async function hasRoleOrPermission(
  auth: AuthEngine,
  user: AuthUser,
  role: string,
  permission: string,
  context?: AuthContext
): Promise<boolean> {
  const [roleResult, permResult] = await Promise.all([
    auth.hasRole(user, role, context),
    auth.can(user, permission, context),
  ]);
  return roleResult || permResult;
}

export async function hasAnyRoleOrPermission(
  auth: AuthEngine,
  user: AuthUser,
  roles: string[],
  permissions: string[],
  context?: AuthContext
): Promise<boolean> {
  const [roleResult, permResult] = await Promise.all([
    hasAnyRole(auth, user, roles, context),
    hasAnyPermission(auth, user, permissions, context),
  ]);
  return roleResult || permResult;
}

// ─── Custom utilities ────────────────────────────────────────────

export function matchesPermission(granted: string, requested: string): boolean {
  if (granted === requested) return true;
  if (granted === '*') return true;

  const escaped = granted
    .split('.')
    .map((segment) => {
      if (segment === '*') return '[^.]+';
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('\\.');

  const regex = new RegExp(`^${escaped}$`);
  return regex.test(requested);
}

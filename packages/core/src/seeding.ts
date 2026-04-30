import type { AuthContext, AuthModel } from './types';
import type { AuthEngine } from './engine';

export interface RoleSeedDefinition {
  permissions?: string[];
}

export type RoleSeedMap = Record<string, string[] | RoleSeedDefinition>;

export interface SeedRolesOptions {
  context?: AuthContext;
}

export interface BootstrapAccessOptions {
  model: AuthModel;
  roles?: string[];
  permissions?: string[];
  context?: AuthContext;
  mode?: 'sync' | 'merge';
}

type RoleSeeder = Pick<AuthEngine, 'assignPermissionToRole' | 'syncRolePermissions'>;
type AccessBootstrapper = Pick<
  AuthEngine,
  'assignRole' | 'givePermissionTo' | 'syncRoles' | 'syncPermissions'
>;

function unique(values: string[] | undefined): string[] {
  return [...new Set(values ?? [])];
}

function normalizeRolePermissions(
  definition: string[] | RoleSeedDefinition | undefined
): string[] {
  if (Array.isArray(definition)) {
    return unique(definition);
  }

  return unique(definition?.permissions);
}

export function defineRoles<T extends RoleSeedMap>(roles: T): T {
  return roles;
}

export async function seedRoles(
  auth: RoleSeeder,
  roles: RoleSeedMap,
  options: SeedRolesOptions = {}
): Promise<void> {
  const entries = Object.entries(roles);

  for (const [role, definition] of entries) {
    const permissions = normalizeRolePermissions(definition);

    for (const permission of permissions) {
      await auth.assignPermissionToRole(role, permission, options.context);
    }
  }
}

export async function syncRolesAndPermissions(
  auth: RoleSeeder,
  roles: RoleSeedMap,
  options: SeedRolesOptions = {}
): Promise<void> {
  const entries = Object.entries(roles);

  for (const [role, definition] of entries) {
    const permissions = normalizeRolePermissions(definition);
    await auth.syncRolePermissions(role, permissions, options.context);
  }
}

export async function bootstrapAccess(
  auth: AccessBootstrapper,
  options: BootstrapAccessOptions
): Promise<void> {
  const roles = unique(options.roles);
  const permissions = unique(options.permissions);
  const mode = options.mode ?? 'sync';

  if (mode === 'merge') {
    for (const role of roles) {
      await auth.assignRole(options.model, role, options.context);
    }

    for (const permission of permissions) {
      await auth.givePermissionTo(options.model, permission, options.context);
    }

    return;
  }

  await auth.syncRoles(options.model, roles, options.context);
  await auth.syncPermissions(options.model, permissions, options.context);
}

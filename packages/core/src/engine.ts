import type { AuthModel, AuthContext, AuthOptions } from './types';
import { PermissionCache } from './cache';
import { Role } from './role';

export class AuthEngine {
  private opts: AuthOptions;
  private cache: PermissionCache | null;

  constructor(opts: AuthOptions) {
    this.opts = opts;
    this.cache = opts.cache ? new PermissionCache(opts.cache) : null;
  }

  // ─── Normalize model ──────────────────────────────────────────────

  private normalizeModel(model: AuthModel): AuthModel {
    return {
      ...model,
      modelType: model.modelType ?? 'User',
    };
  }

  // ─── Wildcard matching ────────────────────────────────────────────

  private matchesPermission(granted: string, requested: string): boolean {
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

  private hasMatchingPermission(
    grantedPermissions: string[],
    requested: string
  ): boolean {
    return grantedPermissions.some((granted) =>
      this.matchesPermission(granted, requested)
    );
  }

  // ─── Cache-aware resolver calls ───────────────────────────────────

  private async resolveAll(
    model: AuthModel,
    context?: AuthContext
  ): Promise<{
    roles: string[];
    directPermissions: string[];
    permissionsThroughRoles: string[];
  }> {
    const normalized = this.normalizeModel(model);

    if (this.cache) {
      const cached = this.cache.get(normalized, context);
      if (cached) {
        return {
          roles: cached.roles,
          directPermissions: cached.directPermissions,
          permissionsThroughRoles: cached.permissionsThroughRoles,
        };
      }
    }

    const [roles, directPermissions, permissionsThroughRoles] =
      await Promise.all([
        this.opts.resolver.getRoles(normalized, context),
        this.opts.resolver.getDirectPermissions(normalized, context),
        this.opts.resolver.getPermissionsThroughRoles(normalized, context),
      ]);

    if (!Array.isArray(roles)) {
      throw new Error(
        '[permifyjs] resolver.getRoles must return Promise<string[]>'
      );
    }

    if (!Array.isArray(directPermissions)) {
      throw new Error(
        '[permifyjs] resolver.getDirectPermissions must return Promise<string[]>'
      );
    }

    if (!Array.isArray(permissionsThroughRoles)) {
      throw new Error(
        '[permifyjs] resolver.getPermissionsThroughRoles must return Promise<string[]>'
      );
    }

    if (this.cache) {
      this.cache.set(normalized, context, {
        roles,
        directPermissions,
        permissionsThroughRoles,
      });
    }

    return { roles, directPermissions, permissionsThroughRoles };
  }

  // ─── Write resolver guard ─────────────────────────────────────────

  private requireWriteResolver(method: string): void {
    if (!this.opts.writeResolver) {
      throw new Error(
        `[permifyjs] writeResolver is required to use ${method}(). ` +
        `Pass a writeResolver to createAuth() to enable assignment methods.`
      );
    }
  }

  // ─── Read API ─────────────────────────────────────────────────────

  async getAllPermissions(
    model: AuthModel,
    context?: AuthContext
  ): Promise<string[]> {
    const { directPermissions, permissionsThroughRoles } =
      await this.resolveAll(model, context);
    return [...new Set([...directPermissions, ...permissionsThroughRoles])];
  }

  async can(
    model: AuthModel,
    permission: string,
    context?: AuthContext
  ): Promise<boolean> {
    const normalized = this.normalizeModel(model);
    const override = await this.opts.beforeCheck?.({
      model: normalized,
      permission,
      context,
    });
    if (override !== null && override !== undefined) return override;

    const all = await this.getAllPermissions(normalized, context);
    return this.hasMatchingPermission(all, permission);
  }

  async canDirectly(
    model: AuthModel,
    permission: string,
    context?: AuthContext
  ): Promise<boolean> {
    const { directPermissions } = await this.resolveAll(model, context);
    return this.hasMatchingPermission(directPermissions, permission);
  }

  async canThroughRole(
    model: AuthModel,
    permission: string,
    context?: AuthContext
  ): Promise<boolean> {
    const { permissionsThroughRoles } = await this.resolveAll(model, context);
    return this.hasMatchingPermission(permissionsThroughRoles, permission);
  }

  async hasRole(
    model: AuthModel,
    role: string,
    context?: AuthContext
  ): Promise<boolean> {
    const normalized = this.normalizeModel(model);
    const override = await this.opts.beforeCheck?.({
      model: normalized,
      role,
      context,
    });
    if (override !== null && override !== undefined) return override;

    const { roles } = await this.resolveAll(normalized, context);
    return roles.includes(role);
  }

  // ─── Role object ──────────────────────────────────────────────────

  role(name: string): Role {
    return new Role(name, this.opts.resolver, this.cache);
  }

  // ─── Model role assignment ────────────────────────────────────────

  async assignRole(
    model: AuthModel,
    role: string,
    context?: AuthContext
  ): Promise<void> {
    this.requireWriteResolver('assignRole');
    const normalized = this.normalizeModel(model);
    await this.opts.writeResolver!.assignRole(normalized, role, context);
    await this.invalidateCache(normalized, context);
  }

  async removeRole(
    model: AuthModel,
    role: string,
    context?: AuthContext
  ): Promise<void> {
    this.requireWriteResolver('removeRole');
    const normalized = this.normalizeModel(model);
    await this.opts.writeResolver!.removeRole(normalized, role, context);
    await this.invalidateCache(normalized, context);
  }

  async syncRoles(
    model: AuthModel,
    roles: string[],
    context?: AuthContext
  ): Promise<void> {
    this.requireWriteResolver('syncRoles');
    const normalized = this.normalizeModel(model);
    await this.opts.writeResolver!.syncRoles(normalized, roles, context);
    await this.invalidateCache(normalized, context);
  }

  // ─── Model direct permission assignment ───────────────────────────

  async givePermissionTo(
    model: AuthModel,
    permission: string,
    context?: AuthContext
  ): Promise<void> {
    this.requireWriteResolver('givePermissionTo');
    const normalized = this.normalizeModel(model);
    await this.opts.writeResolver!.givePermissionTo(normalized, permission, context);
    await this.invalidateCache(normalized, context);
  }

  async revokePermissionTo(
    model: AuthModel,
    permission: string,
    context?: AuthContext
  ): Promise<void> {
    this.requireWriteResolver('revokePermissionTo');
    const normalized = this.normalizeModel(model);
    await this.opts.writeResolver!.revokePermissionTo(normalized, permission, context);
    await this.invalidateCache(normalized, context);
  }

  async syncPermissions(
    model: AuthModel,
    permissions: string[],
    context?: AuthContext
  ): Promise<void> {
    this.requireWriteResolver('syncPermissions');
    const normalized = this.normalizeModel(model);
    await this.opts.writeResolver!.syncPermissions(normalized, permissions, context);
    await this.invalidateCache(normalized, context);
  }

  // ─── Role permission assignment ───────────────────────────────────

  async assignPermissionToRole(
    role: string,
    permission: string,
    context?: AuthContext
  ): Promise<void> {
    this.requireWriteResolver('assignPermissionToRole');
    await this.opts.writeResolver!.assignPermissionToRole(role, permission, context);
    await this.invalidateRoleCache(role);
  }

  async revokePermissionFromRole(
    role: string,
    permission: string,
    context?: AuthContext
  ): Promise<void> {
    this.requireWriteResolver('revokePermissionFromRole');
    await this.opts.writeResolver!.revokePermissionFromRole(role, permission, context);
    await this.invalidateRoleCache(role);
  }

  async syncRolePermissions(
    role: string,
    permissions: string[],
    context?: AuthContext
  ): Promise<void> {
    this.requireWriteResolver('syncRolePermissions');
    await this.opts.writeResolver!.syncRolePermissions(role, permissions, context);
    await this.invalidateRoleCache(role);
  }

  // ─── Cache management ─────────────────────────────────────────────

  async invalidateCache(model: AuthModel, context?: AuthContext): Promise<void> {
    if (!this.cache) return;
    if (context) {
      this.cache.invalidateUserContext(model, context);
    } else {
      this.cache.invalidateUser(model);
    }
  }

  async invalidateRoleCache(role: string): Promise<void> {
    if (!this.cache) return;
    this.cache.invalidateRole(role);
  }

  async clearCache(): Promise<void> {
    if (!this.cache) return;
    this.cache.clear();
  }

  isCacheEnabled(): boolean {
    return this.cache !== null;
  }

  cacheSize(): number {
    return this.cache?.size() ?? 0;
  }
}

export function createAuth(opts: AuthOptions): AuthEngine {
  if (!opts.resolver) {
    throw new Error('[permifyjs] resolver is required');
  }

  if (typeof opts.resolver.getRoles !== 'function') {
    throw new Error(
      '[permifyjs] resolver.getRoles must be a function that returns Promise<string[]>'
    );
  }

  if (typeof opts.resolver.getDirectPermissions !== 'function') {
    throw new Error(
      '[permifyjs] resolver.getDirectPermissions must be a function that returns Promise<string[]>'
    );
  }

  if (typeof opts.resolver.getPermissionsThroughRoles !== 'function') {
    throw new Error(
      '[permifyjs] resolver.getPermissionsThroughRoles must be a function that returns Promise<string[]>'
    );
  }

  if (typeof opts.resolver.getRolePermissions !== 'function') {
    throw new Error(
      '[permifyjs] resolver.getRolePermissions must be a function that returns Promise<string[]>'
    );
  }

  return new AuthEngine(opts);
}

// ─── defineConfig helper (used in permifyjs.config.ts) ───────────

export function defineConfig(config: import('./types').PermifyConfig) {
  return config;
}

import type { AuthContext, PermissionResolver } from './types';
import type { PermissionCache } from './cache';
import { matchesPermission } from './utils';

export class Role {
  private name: string;
  private resolver: PermissionResolver;
  private cache: PermissionCache | null;

  constructor(
    name: string,
    resolver: PermissionResolver,
    cache: PermissionCache | null = null
  ) {
    this.name = name;
    this.resolver = resolver;
    this.cache = cache;
  }

  // ─── Getters ──────────────────────────────────────────────────────

  getName(): string {
    return this.name;
  }

  // ─── Permission resolution ────────────────────────────────────────

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

  // Fetch permissions for this role — cache aware
  async getPermissions(context?: AuthContext): Promise<string[]> {
    if (this.cache) {
      const cached = this.cache.getRolePermissions(this.name, context);
      if (cached) return cached;
    }

    const permissions = await this.resolver.getRolePermissions(
      this.name,
      context
    );

    if (!Array.isArray(permissions)) {
      throw new Error(
        `[permifyjs] resolver.getRolePermissions must return Promise<string[]> for role "${this.name}"`
      );
    }

    if (this.cache) {
      this.cache.setRolePermissions(this.name, context, permissions);
    }

    return permissions;
  }

  // ─── Permission checks ────────────────────────────────────────────

  async hasPermissionTo(
    permission: string,
    context?: AuthContext
  ): Promise<boolean> {
    const permissions = await this.getPermissions(context);
    return permissions.some((p) => matchesPermission(p, permission));
  }

  async hasAnyPermission(
    permissions: string[],
    context?: AuthContext
  ): Promise<boolean> {
    const results = await Promise.all(
      permissions.map((p) => this.hasPermissionTo(p, context))
    );
    return results.some(Boolean);
  }

  async hasAllPermissions(
    permissions: string[],
    context?: AuthContext
  ): Promise<boolean> {
    const results = await Promise.all(
      permissions.map((p) => this.hasPermissionTo(p, context))
    );
    return results.every(Boolean);
  }
}

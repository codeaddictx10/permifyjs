export interface AuthModel {
  id: string;
  modelType?: string;  // optional — defaults to 'User'
  [key: string]: unknown;
}

// backward compatible alias — existing code using AuthUser still works
export type AuthUser = AuthModel;

export interface AuthContext {
  teamId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

export type ScopeMode = 'global' | 'tenant' | 'team' | 'tenant-team';

export interface PermissionResolver {
  getRoles(model: AuthModel, context?: AuthContext): Promise<string[]>;
  getDirectPermissions(model: AuthModel, context?: AuthContext): Promise<string[]>;
  getPermissionsThroughRoles(model: AuthModel, context?: AuthContext): Promise<string[]>;
  getRolePermissions(role: string, context?: AuthContext): Promise<string[]>;
}

export interface PermissionWriteResolver {
  // ─── Model role assignment ──────────────────────────────────────
  assignRole(model: AuthModel, role: string, context?: AuthContext): Promise<void>;
  removeRole(model: AuthModel, role: string, context?: AuthContext): Promise<void>;
  syncRoles(model: AuthModel, roles: string[], context?: AuthContext): Promise<void>;

  // ─── Model direct permission assignment ─────────────────────────
  givePermissionTo(model: AuthModel, permission: string, context?: AuthContext): Promise<void>;
  revokePermissionTo(model: AuthModel, permission: string, context?: AuthContext): Promise<void>;
  syncPermissions(model: AuthModel, permissions: string[], context?: AuthContext): Promise<void>;

  // ─── Role permission assignment ─────────────────────────────────
  assignPermissionToRole(role: string, permission: string, context?: AuthContext): Promise<void>;
  revokePermissionFromRole(role: string, permission: string, context?: AuthContext): Promise<void>;
  syncRolePermissions(role: string, permissions: string[], context?: AuthContext): Promise<void>;
}

export interface CacheOptions {
  ttl?: number;
  max?: number;
  prefix?: string;
  store?: CacheStore<CacheValue>;
}

export interface CacheEntry {
  roles: string[];
  directPermissions: string[];
  permissionsThroughRoles: string[];
  expiresAt: number;
}

export interface RoleCacheEntry {
  permissions: string[];
  expiresAt: number;
}

export type CacheValue = CacheEntry | RoleCacheEntry;

export interface CacheStore<T = CacheValue> {
  get(key: string): T | null | undefined;
  set(key: string, value: T): void;
  delete(key: string): void;
  clear(): void;
  keys(): Iterable<string>;
  size?(): number;
}

export interface BeforeCheckOptions {
  model: AuthModel;
  permission?: string;
  role?: string;
  context?: AuthContext;
}

export interface AuthOptions {
  resolver: PermissionResolver;
  writeResolver?: PermissionWriteResolver;
  cache?: CacheOptions;
  beforeCheck?: (params: BeforeCheckOptions) => boolean | null | Promise<boolean | null>;
}

// ─── Config types (used by CLI) ───────────────────────────────────

export type AdapterType = 'prisma' | 'mongoose' | 'typeorm';
export type FrameworkType = 'express' | 'nestjs' | 'fastify';

export interface PermifyConfig {
  adapter: AdapterType;
  framework: FrameworkType;
  models?: string[];
  scopeMode?: ScopeMode;
  cache?: CacheOptions;
  tables?: {
    roles?: string;
    permissions?: string;
    roleHasPermissions?: string;
    modelHasRoles?: string;
    modelHasPermissions?: string;
  };
}

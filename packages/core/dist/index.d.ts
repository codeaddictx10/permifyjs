interface AuthModel {
    id: string;
    modelType?: string;
    [key: string]: unknown;
}
type AuthUser = AuthModel;
interface AuthContext {
    teamId?: string;
    tenantId?: string;
    [key: string]: unknown;
}
type ScopeMode = 'global' | 'tenant' | 'team' | 'tenant-team';
interface PermissionResolver {
    getRoles(model: AuthModel, context?: AuthContext): Promise<string[]>;
    getDirectPermissions(model: AuthModel, context?: AuthContext): Promise<string[]>;
    getPermissionsThroughRoles(model: AuthModel, context?: AuthContext): Promise<string[]>;
    getRolePermissions(role: string, context?: AuthContext): Promise<string[]>;
}
interface PermissionWriteResolver {
    assignRole(model: AuthModel, role: string, context?: AuthContext): Promise<void>;
    removeRole(model: AuthModel, role: string, context?: AuthContext): Promise<void>;
    syncRoles(model: AuthModel, roles: string[], context?: AuthContext): Promise<void>;
    givePermissionTo(model: AuthModel, permission: string, context?: AuthContext): Promise<void>;
    revokePermissionTo(model: AuthModel, permission: string, context?: AuthContext): Promise<void>;
    syncPermissions(model: AuthModel, permissions: string[], context?: AuthContext): Promise<void>;
    assignPermissionToRole(role: string, permission: string, context?: AuthContext): Promise<void>;
    revokePermissionFromRole(role: string, permission: string, context?: AuthContext): Promise<void>;
    syncRolePermissions(role: string, permissions: string[], context?: AuthContext): Promise<void>;
}
interface CacheOptions {
    ttl?: number;
    max?: number;
    prefix?: string;
    store?: CacheStore<CacheValue>;
}
interface CacheEntry {
    roles: string[];
    directPermissions: string[];
    permissionsThroughRoles: string[];
    expiresAt: number;
}
interface RoleCacheEntry {
    permissions: string[];
    expiresAt: number;
}
type CacheValue = CacheEntry | RoleCacheEntry;
interface CacheStore<T = CacheValue> {
    get(key: string): T | null | undefined;
    set(key: string, value: T): void;
    delete(key: string): void;
    clear(): void;
    keys(): Iterable<string>;
    size?(): number;
}
interface BeforeCheckOptions {
    model: AuthModel;
    permission?: string;
    role?: string;
    context?: AuthContext;
}
interface AuthOptions {
    resolver: PermissionResolver;
    writeResolver?: PermissionWriteResolver;
    cache?: CacheOptions;
    beforeCheck?: (params: BeforeCheckOptions) => boolean | null | Promise<boolean | null>;
}
type AdapterType = 'prisma' | 'mongoose' | 'typeorm';
type FrameworkType = 'express' | 'nestjs' | 'fastify';
interface PermifyConfig {
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

declare class MemoryCacheStore<T = CacheValue> implements CacheStore<T> {
    private map;
    get(key: string): T | null;
    set(key: string, value: T): void;
    delete(key: string): void;
    clear(): void;
    keys(): Iterable<string>;
    size(): number;
}
declare class PermissionCache {
    private store;
    private ttl;
    private max;
    private prefix;
    constructor(opts?: CacheOptions);
    buildKey(user: AuthUser, context?: AuthContext): string;
    buildRoleKey(role: string, context?: AuthContext): string;
    private buildContextKey;
    private userPrefix;
    private rolePrefix;
    private filterKeys;
    private userKeys;
    private countKeys;
    private evictOldest;
    get(user: AuthUser, context?: AuthContext): CacheEntry | null;
    set(user: AuthUser, context: AuthContext | undefined, data: Omit<CacheEntry, 'expiresAt'>): void;
    getRolePermissions(role: string, context?: AuthContext): string[] | null;
    setRolePermissions(role: string, context: AuthContext | undefined, permissions: string[]): void;
    invalidateRole(role: string): void;
    invalidateUser(user: AuthUser): void;
    invalidateUserContext(user: AuthUser, context?: AuthContext): void;
    clear(): void;
    size(): number;
    roleStoreSize(): number;
    has(user: AuthUser, context?: AuthContext): boolean;
}

declare class Role {
    private name;
    private resolver;
    private cache;
    constructor(name: string, resolver: PermissionResolver, cache?: PermissionCache | null);
    getName(): string;
    private matchesPermission;
    getPermissions(context?: AuthContext): Promise<string[]>;
    hasPermissionTo(permission: string, context?: AuthContext): Promise<boolean>;
    hasAnyPermission(permissions: string[], context?: AuthContext): Promise<boolean>;
    hasAllPermissions(permissions: string[], context?: AuthContext): Promise<boolean>;
}

declare class AuthEngine {
    private opts;
    private cache;
    constructor(opts: AuthOptions);
    private normalizeModel;
    private matchesPermission;
    private hasMatchingPermission;
    private resolveAll;
    private requireWriteResolver;
    getAllPermissions(model: AuthModel, context?: AuthContext): Promise<string[]>;
    can(model: AuthModel, permission: string, context?: AuthContext): Promise<boolean>;
    canDirectly(model: AuthModel, permission: string, context?: AuthContext): Promise<boolean>;
    canThroughRole(model: AuthModel, permission: string, context?: AuthContext): Promise<boolean>;
    hasRole(model: AuthModel, role: string, context?: AuthContext): Promise<boolean>;
    role(name: string): Role;
    assignRole(model: AuthModel, role: string, context?: AuthContext): Promise<void>;
    removeRole(model: AuthModel, role: string, context?: AuthContext): Promise<void>;
    syncRoles(model: AuthModel, roles: string[], context?: AuthContext): Promise<void>;
    givePermissionTo(model: AuthModel, permission: string, context?: AuthContext): Promise<void>;
    revokePermissionTo(model: AuthModel, permission: string, context?: AuthContext): Promise<void>;
    syncPermissions(model: AuthModel, permissions: string[], context?: AuthContext): Promise<void>;
    assignPermissionToRole(role: string, permission: string, context?: AuthContext): Promise<void>;
    revokePermissionFromRole(role: string, permission: string, context?: AuthContext): Promise<void>;
    syncRolePermissions(role: string, permissions: string[], context?: AuthContext): Promise<void>;
    invalidateCache(model: AuthModel, context?: AuthContext): Promise<void>;
    invalidateRoleCache(role: string): Promise<void>;
    clearCache(): Promise<void>;
    isCacheEnabled(): boolean;
    cacheSize(): number;
}
declare function createAuth(opts: AuthOptions): AuthEngine;
declare function defineConfig(config: PermifyConfig): PermifyConfig;

declare const DEFAULT_SCOPE_MODE: ScopeMode;
declare const INIT_DEFAULT_SCOPE_MODE: ScopeMode;
declare function normalizeScopeMode(scopeMode?: ScopeMode): ScopeMode;
declare function hasTenantScope(scopeMode?: ScopeMode): boolean;
declare function hasTeamScope(scopeMode?: ScopeMode): boolean;
declare function getEnabledScopeFields(scopeMode?: ScopeMode): Array<'tenantId' | 'teamId'>;

interface RoleSeedDefinition {
    permissions?: string[];
}
type RoleSeedMap = Record<string, string[] | RoleSeedDefinition>;
interface SeedRolesOptions {
    context?: AuthContext;
}
interface BootstrapAccessOptions {
    model: AuthModel;
    roles?: string[];
    permissions?: string[];
    context?: AuthContext;
    mode?: 'sync' | 'merge';
}
type RoleSeeder = Pick<AuthEngine, 'assignPermissionToRole' | 'syncRolePermissions'>;
type AccessBootstrapper = Pick<AuthEngine, 'assignRole' | 'givePermissionTo' | 'syncRoles' | 'syncPermissions'>;
declare function defineRoles<T extends RoleSeedMap>(roles: T): T;
declare function seedRoles(auth: RoleSeeder, roles: RoleSeedMap, options?: SeedRolesOptions): Promise<void>;
declare function syncRolesAndPermissions(auth: RoleSeeder, roles: RoleSeedMap, options?: SeedRolesOptions): Promise<void>;
declare function bootstrapAccess(auth: AccessBootstrapper, options: BootstrapAccessOptions): Promise<void>;

declare function hasAnyRole(auth: AuthEngine, user: AuthUser, roles: string[], context?: AuthContext): Promise<boolean>;
declare function hasAllRoles(auth: AuthEngine, user: AuthUser, roles: string[], context?: AuthContext): Promise<boolean>;
declare function hasAnyPermission(auth: AuthEngine, user: AuthUser, permissions: string[], context?: AuthContext): Promise<boolean>;
declare function hasAllPermissions(auth: AuthEngine, user: AuthUser, permissions: string[], context?: AuthContext): Promise<boolean>;
declare function hasAnyDirectPermission(auth: AuthEngine, user: AuthUser, permissions: string[], context?: AuthContext): Promise<boolean>;
declare function hasAllDirectPermissions(auth: AuthEngine, user: AuthUser, permissions: string[], context?: AuthContext): Promise<boolean>;
declare function hasRoleOrPermission(auth: AuthEngine, user: AuthUser, role: string, permission: string, context?: AuthContext): Promise<boolean>;
declare function hasAnyRoleOrPermission(auth: AuthEngine, user: AuthUser, roles: string[], permissions: string[], context?: AuthContext): Promise<boolean>;

export { type AdapterType, type AuthContext, AuthEngine, type AuthModel, type AuthOptions, type AuthUser, type BeforeCheckOptions, type BootstrapAccessOptions, type CacheEntry, type CacheOptions, type CacheStore, type CacheValue, DEFAULT_SCOPE_MODE, type FrameworkType, INIT_DEFAULT_SCOPE_MODE, MemoryCacheStore, type PermifyConfig, PermissionCache, type PermissionResolver, type PermissionWriteResolver, Role, type RoleCacheEntry, type RoleSeedDefinition, type RoleSeedMap, type ScopeMode, type SeedRolesOptions, bootstrapAccess, createAuth, defineConfig, defineRoles, getEnabledScopeFields, hasAllDirectPermissions, hasAllPermissions, hasAllRoles, hasAnyDirectPermission, hasAnyPermission, hasAnyRole, hasAnyRoleOrPermission, hasRoleOrPermission, hasTeamScope, hasTenantScope, normalizeScopeMode, seedRoles, syncRolesAndPermissions };

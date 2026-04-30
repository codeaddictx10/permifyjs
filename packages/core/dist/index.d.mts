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
interface AuthOptions {
    resolver: PermissionResolver;
    writeResolver?: PermissionWriteResolver;
    cache?: CacheOptions;
    beforeCheck?: (params: {
        model: AuthModel;
        permission?: string;
        role?: string;
        context?: AuthContext;
    }) => boolean | null | Promise<boolean | null>;
}
type AdapterType = 'prisma' | 'mongoose' | 'typeorm';
type FrameworkType = 'express' | 'nestjs' | 'fastify';
interface PermifyConfig {
    adapter: AdapterType;
    framework: FrameworkType;
    models?: string[];
    cache?: CacheOptions;
    tables?: {
        roles?: string;
        permissions?: string;
        roleHasPermissions?: string;
        modelHasRoles?: string;
        modelHasPermissions?: string;
    };
}

declare class PermissionCache {
    private store;
    private roleStore;
    private ttl;
    private max;
    private prefix;
    constructor(opts?: CacheOptions);
    buildKey(user: AuthUser, context?: AuthContext): string;
    buildRoleKey(role: string, context?: AuthContext): string;
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

declare function hasAnyRole(auth: AuthEngine, user: AuthUser, roles: string[], context?: AuthContext): Promise<boolean>;
declare function hasAllRoles(auth: AuthEngine, user: AuthUser, roles: string[], context?: AuthContext): Promise<boolean>;
declare function hasAnyPermission(auth: AuthEngine, user: AuthUser, permissions: string[], context?: AuthContext): Promise<boolean>;
declare function hasAllPermissions(auth: AuthEngine, user: AuthUser, permissions: string[], context?: AuthContext): Promise<boolean>;
declare function hasAnyDirectPermission(auth: AuthEngine, user: AuthUser, permissions: string[], context?: AuthContext): Promise<boolean>;
declare function hasAllDirectPermissions(auth: AuthEngine, user: AuthUser, permissions: string[], context?: AuthContext): Promise<boolean>;
declare function hasRoleOrPermission(auth: AuthEngine, user: AuthUser, role: string, permission: string, context?: AuthContext): Promise<boolean>;
declare function hasAnyRoleOrPermission(auth: AuthEngine, user: AuthUser, roles: string[], permissions: string[], context?: AuthContext): Promise<boolean>;

export { type AdapterType, type AuthContext, AuthEngine, type AuthModel, type AuthOptions, type AuthUser, type CacheEntry, type CacheOptions, type FrameworkType, type PermifyConfig, PermissionCache, type PermissionResolver, type PermissionWriteResolver, Role, type RoleCacheEntry, createAuth, defineConfig, hasAllDirectPermissions, hasAllPermissions, hasAllRoles, hasAnyDirectPermission, hasAnyPermission, hasAnyRole, hasAnyRoleOrPermission, hasRoleOrPermission };

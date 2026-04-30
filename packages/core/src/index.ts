export type {
  AuthModel,
  AuthUser,           // backward compat alias
  AuthContext,
  PermissionResolver,
  PermissionWriteResolver,
  AuthOptions,
  CacheOptions,
  CacheStore,
  CacheEntry,
  CacheValue,
  RoleCacheEntry,
  PermifyConfig,
  AdapterType,
  FrameworkType,
} from './types';

export { AuthEngine, createAuth, defineConfig } from './engine';
export { MemoryCacheStore, PermissionCache } from './cache';
export { Role } from './role';
export {
  bootstrapAccess,
  defineRoles,
  seedRoles,
  syncRolesAndPermissions,
} from './seeding';
export type {
  BootstrapAccessOptions,
  RoleSeedDefinition,
  RoleSeedMap,
  SeedRolesOptions,
} from './seeding';

export {
  hasAnyRole,
  hasAllRoles,
  hasAnyPermission,
  hasAllPermissions,
  hasAnyDirectPermission,
  hasAllDirectPermissions,
  hasRoleOrPermission,
  hasAnyRoleOrPermission,
} from './utils';

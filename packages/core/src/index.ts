export type {
  AuthModel,
  AuthUser,           // backward compat alias
  AuthContext,
  ScopeMode,
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
  BeforeCheckOptions,
} from './types';

export { AuthEngine, createAuth, defineConfig } from './engine';
export { MemoryCacheStore, PermissionCache } from './cache';
export {
  DEFAULT_SCOPE_MODE,
  INIT_DEFAULT_SCOPE_MODE,
  normalizeScopeMode,
  hasTenantScope,
  hasTeamScope,
  getEnabledScopeFields,
} from './scope';
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

// src/cache.ts
var MemoryCacheStore = class {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  get(key) {
    return this.map.get(key) ?? null;
  }
  set(key, value) {
    this.map.set(key, value);
  }
  delete(key) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
  keys() {
    return this.map.keys();
  }
  size() {
    return this.map.size;
  }
};
var PermissionCache = class {
  constructor(opts = {}) {
    this.store = opts.store ?? new MemoryCacheStore();
    this.ttl = (opts.ttl ?? 60) * 1e3;
    this.max = opts.max ?? 500;
    this.prefix = opts.prefix ?? "permifyjs";
  }
  // ─── Key generation ───────────────────────────────────────────────
  buildKey(user, context) {
    const contextKey = this.buildContextKey(context);
    return `${this.prefix}:${user.id}:${contextKey}`;
  }
  buildRoleKey(role, context) {
    const contextKey = this.buildContextKey(context);
    return `${this.prefix}:role:${role}:${contextKey}`;
  }
  buildContextKey(context) {
    if (context) {
      let key = JSON.stringify(context);
      if (key != "{}") {
        return key;
      }
    }
    return `default`;
  }
  userPrefix(user) {
    return `${this.prefix}:${user.id}:`;
  }
  rolePrefix(role) {
    return `${this.prefix}:role:${role}:`;
  }
  *filterKeys(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        yield key;
      }
    }
  }
  *userKeys() {
    for (const key of this.filterKeys(`${this.prefix}:`)) {
      if (!key.startsWith(`${this.prefix}:role:`)) {
        yield key;
      }
    }
  }
  countKeys(keys) {
    let count = 0;
    for (const _key of keys) {
      count += 1;
    }
    return count;
  }
  evictOldest(keys) {
    const oldestKey = keys[Symbol.iterator]().next().value;
    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }
  // ─── User cache ───────────────────────────────────────────────────
  get(user, context) {
    const key = this.buildKey(user, context);
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }
  set(user, context, data) {
    if (this.size() >= this.max) {
      this.evictOldest(this.userKeys());
    }
    const key = this.buildKey(user, context);
    this.store.set(key, {
      ...data,
      expiresAt: Date.now() + this.ttl
    });
  }
  // ─── Role cache ───────────────────────────────────────────────────
  getRolePermissions(role, context) {
    const key = this.buildRoleKey(role, context);
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.permissions;
  }
  setRolePermissions(role, context, permissions) {
    if (this.roleStoreSize() >= this.max) {
      this.evictOldest(this.filterKeys(`${this.prefix}:role:`));
    }
    const key = this.buildRoleKey(role, context);
    this.store.set(key, {
      permissions,
      expiresAt: Date.now() + this.ttl
    });
  }
  invalidateRole(role) {
    for (const key of this.filterKeys(this.rolePrefix(role))) {
      this.store.delete(key);
    }
  }
  // ─── User invalidation ────────────────────────────────────────────
  invalidateUser(user) {
    for (const key of this.filterKeys(this.userPrefix(user))) {
      this.store.delete(key);
    }
  }
  invalidateUserContext(user, context) {
    const key = this.buildKey(user, context);
    this.store.delete(key);
  }
  // ─── Clear all ────────────────────────────────────────────────────
  clear() {
    this.store.clear();
  }
  // ─── Internals ────────────────────────────────────────────────────
  size() {
    return this.countKeys(this.userKeys());
  }
  roleStoreSize() {
    return this.countKeys(this.filterKeys(`${this.prefix}:role:`));
  }
  has(user, context) {
    return this.get(user, context) !== null;
  }
};

// src/utils.ts
async function getRoles(auth, user, context) {
  return auth.getRoles(user, context);
}
async function getDirectPermissions(auth, user, context) {
  return auth.getDirectPermissions(user, context);
}
async function getPermissionsThroughRoles(auth, user, context) {
  return auth.getPermissionsThroughRoles(user, context);
}
async function getAllPermissions(auth, user, context) {
  return auth.getAllPermissions(user, context);
}
async function getRolePermissions(auth, role, context) {
  return auth.getRolePermissions(role, context);
}
async function hasAnyRole(auth, user, roles, context) {
  const results = await Promise.all(
    roles.map((role) => auth.hasRole(user, role, context))
  );
  return results.some(Boolean);
}
async function hasAllRoles(auth, user, roles, context) {
  const results = await Promise.all(
    roles.map((role) => auth.hasRole(user, role, context))
  );
  return results.every(Boolean);
}
async function hasExactRoles(auth, user, roles, context) {
  return auth.hasExactRoles(user, roles, context);
}
async function hasAnyPermission(auth, user, permissions, context) {
  const results = await Promise.all(
    permissions.map((p) => auth.can(user, p, context))
  );
  return results.some(Boolean);
}
async function hasAllPermissions(auth, user, permissions, context) {
  const results = await Promise.all(
    permissions.map((p) => auth.can(user, p, context))
  );
  return results.every(Boolean);
}
async function hasAnyDirectPermission(auth, user, permissions, context) {
  const results = await Promise.all(
    permissions.map((p) => auth.canDirectly(user, p, context))
  );
  return results.some(Boolean);
}
async function hasAllDirectPermissions(auth, user, permissions, context) {
  const results = await Promise.all(
    permissions.map((p) => auth.canDirectly(user, p, context))
  );
  return results.every(Boolean);
}
async function hasRoleOrPermission(auth, user, role, permission, context) {
  const [roleResult, permResult] = await Promise.all([
    auth.hasRole(user, role, context),
    auth.can(user, permission, context)
  ]);
  return roleResult || permResult;
}
async function hasAnyRoleOrPermission(auth, user, roles, permissions, context) {
  const [roleResult, permResult] = await Promise.all([
    hasAnyRole(auth, user, roles, context),
    hasAnyPermission(auth, user, permissions, context)
  ]);
  return roleResult || permResult;
}
function matchesPermission(granted, requested) {
  if (granted === requested) return true;
  if (granted === "*") return true;
  const escaped = granted.split(".").map((segment) => {
    if (segment === "*") return "[^.]+";
    return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("\\.");
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(requested);
}

// src/role.ts
var Role = class {
  constructor(name, resolver, cache = null) {
    this.name = name;
    this.resolver = resolver;
    this.cache = cache;
  }
  // ─── Getters ──────────────────────────────────────────────────────
  getName() {
    return this.name;
  }
  // ─── Permission resolution ────────────────────────────────────────
  matchesPermission(granted, requested) {
    if (granted === requested) return true;
    if (granted === "*") return true;
    const escaped = granted.split(".").map((segment) => {
      if (segment === "*") return "[^.]+";
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("\\.");
    const regex = new RegExp(`^${escaped}$`);
    return regex.test(requested);
  }
  // Fetch permissions for this role — cache aware
  async getPermissions(context) {
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
  async hasPermissionTo(permission, context) {
    const permissions = await this.getPermissions(context);
    return permissions.some((p) => matchesPermission(p, permission));
  }
  async hasAnyPermission(permissions, context) {
    const results = await Promise.all(
      permissions.map((p) => this.hasPermissionTo(p, context))
    );
    return results.some(Boolean);
  }
  async hasAllPermissions(permissions, context) {
    const results = await Promise.all(
      permissions.map((p) => this.hasPermissionTo(p, context))
    );
    return results.every(Boolean);
  }
};

// src/engine.ts
var AuthEngine = class {
  constructor(opts) {
    this.opts = opts;
    this.cache = opts.cache ? new PermissionCache(opts.cache) : null;
  }
  // ─── Normalize model ──────────────────────────────────────────────
  normalizeModel(model) {
    return {
      ...model,
      modelType: model.modelType ?? "User"
    };
  }
  // ─── Wildcard matching ────────────────────────────────────────────
  matchesPermission(granted, requested) {
    if (granted === requested) return true;
    if (granted === "*") return true;
    const escaped = granted.split(".").map((segment) => {
      if (segment === "*") return "[^.]+";
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("\\.");
    const regex = new RegExp(`^${escaped}$`);
    return regex.test(requested);
  }
  hasMatchingPermission(grantedPermissions, requested) {
    return grantedPermissions.some(
      (granted) => this.matchesPermission(granted, requested)
    );
  }
  // ─── Cache-aware resolver calls ───────────────────────────────────
  async resolveAll(model, context) {
    const normalized = this.normalizeModel(model);
    if (this.cache) {
      const cached = this.cache.get(normalized, context);
      if (cached) {
        return {
          roles: cached.roles,
          directPermissions: cached.directPermissions,
          permissionsThroughRoles: cached.permissionsThroughRoles
        };
      }
    }
    const [roles, directPermissions, permissionsThroughRoles] = await Promise.all([
      this.opts.resolver.getRoles(normalized, context),
      this.opts.resolver.getDirectPermissions(normalized, context),
      this.opts.resolver.getPermissionsThroughRoles(normalized, context)
    ]);
    if (!Array.isArray(roles)) {
      throw new Error(
        "[permifyjs] resolver.getRoles must return Promise<string[]>"
      );
    }
    if (!Array.isArray(directPermissions)) {
      throw new Error(
        "[permifyjs] resolver.getDirectPermissions must return Promise<string[]>"
      );
    }
    if (!Array.isArray(permissionsThroughRoles)) {
      throw new Error(
        "[permifyjs] resolver.getPermissionsThroughRoles must return Promise<string[]>"
      );
    }
    if (this.cache) {
      this.cache.set(normalized, context, {
        roles,
        directPermissions,
        permissionsThroughRoles
      });
    }
    return { roles, directPermissions, permissionsThroughRoles };
  }
  // ─── Write resolver guard ─────────────────────────────────────────
  requireWriteResolver(method) {
    if (!this.opts.writeResolver) {
      throw new Error(
        `[permifyjs] writeResolver is required to use ${method}(). Pass a writeResolver to createAuth() to enable assignment methods.`
      );
    }
  }
  // ─── Read API ─────────────────────────────────────────────────────
  async getAllPermissions(model, context) {
    const { directPermissions, permissionsThroughRoles } = await this.resolveAll(model, context);
    return [.../* @__PURE__ */ new Set([...directPermissions, ...permissionsThroughRoles])];
  }
  async getRoles(model, context) {
    const { roles } = await this.resolveAll(model, context);
    return [...roles];
  }
  async getDirectPermissions(model, context) {
    const { directPermissions } = await this.resolveAll(model, context);
    return [...directPermissions];
  }
  async getPermissionsThroughRoles(model, context) {
    const { permissionsThroughRoles } = await this.resolveAll(model, context);
    return [...permissionsThroughRoles];
  }
  async getRolePermissions(role, context) {
    return this.role(role).getPermissions(context);
  }
  async can(model, permission, context) {
    const normalized = this.normalizeModel(model);
    if (normalized.id === null || normalized.id === void 0) return false;
    const override = await this.opts.beforeCheck?.({
      model: normalized,
      permission,
      context
    });
    if (override !== null && override !== void 0) return override;
    const all = await this.getAllPermissions(normalized, context);
    return this.hasMatchingPermission(all, permission);
  }
  async canDirectly(model, permission, context) {
    const { directPermissions } = await this.resolveAll(model, context);
    return this.hasMatchingPermission(directPermissions, permission);
  }
  async canThroughRole(model, permission, context) {
    const { permissionsThroughRoles } = await this.resolveAll(model, context);
    return this.hasMatchingPermission(permissionsThroughRoles, permission);
  }
  async hasRole(model, role, context) {
    const normalized = this.normalizeModel(model);
    const override = await this.opts.beforeCheck?.({
      model: normalized,
      role,
      context
    });
    if (override !== null && override !== void 0) return override;
    const { roles } = await this.resolveAll(normalized, context);
    return roles.includes(role);
  }
  async hasExactRoles(model, roles, context) {
    const currentRoles = await this.getRoles(model, context);
    const expected = [...new Set(roles)].sort();
    const actual = [...new Set(currentRoles)].sort();
    if (expected.length !== actual.length) return false;
    return expected.every((role, index) => role === actual[index]);
  }
  // ─── Role object ──────────────────────────────────────────────────
  role(name) {
    return new Role(name, this.opts.resolver, this.cache);
  }
  // ─── Model role assignment ────────────────────────────────────────
  async assignRole(model, role, context) {
    this.requireWriteResolver("assignRole");
    const normalized = this.normalizeModel(model);
    await this.opts.writeResolver.assignRole(normalized, role, context);
    await this.invalidateCache(normalized, context);
  }
  async removeRole(model, role, context) {
    this.requireWriteResolver("removeRole");
    const normalized = this.normalizeModel(model);
    await this.opts.writeResolver.removeRole(normalized, role, context);
    await this.invalidateCache(normalized, context);
  }
  async syncRoles(model, roles, context) {
    this.requireWriteResolver("syncRoles");
    const normalized = this.normalizeModel(model);
    await this.opts.writeResolver.syncRoles(normalized, roles, context);
    await this.invalidateCache(normalized, context);
  }
  // ─── Model direct permission assignment ───────────────────────────
  async givePermissionTo(model, permission, context) {
    this.requireWriteResolver("givePermissionTo");
    const normalized = this.normalizeModel(model);
    await this.opts.writeResolver.givePermissionTo(normalized, permission, context);
    await this.invalidateCache(normalized, context);
  }
  async revokePermissionTo(model, permission, context) {
    this.requireWriteResolver("revokePermissionTo");
    const normalized = this.normalizeModel(model);
    await this.opts.writeResolver.revokePermissionTo(normalized, permission, context);
    await this.invalidateCache(normalized, context);
  }
  async syncPermissions(model, permissions, context) {
    this.requireWriteResolver("syncPermissions");
    const normalized = this.normalizeModel(model);
    await this.opts.writeResolver.syncPermissions(normalized, permissions, context);
    await this.invalidateCache(normalized, context);
  }
  // ─── Role permission assignment ───────────────────────────────────
  async assignPermissionToRole(role, permission, context) {
    this.requireWriteResolver("assignPermissionToRole");
    await this.opts.writeResolver.assignPermissionToRole(role, permission, context);
    await this.invalidateRoleCache(role);
  }
  async revokePermissionFromRole(role, permission, context) {
    this.requireWriteResolver("revokePermissionFromRole");
    await this.opts.writeResolver.revokePermissionFromRole(role, permission, context);
    await this.invalidateRoleCache(role);
  }
  async syncRolePermissions(role, permissions, context) {
    this.requireWriteResolver("syncRolePermissions");
    await this.opts.writeResolver.syncRolePermissions(role, permissions, context);
    await this.invalidateRoleCache(role);
  }
  // ─── Cache management ─────────────────────────────────────────────
  async invalidateCache(model, context) {
    if (!this.cache) return;
    if (context) {
      this.cache.invalidateUserContext(model, context);
    } else {
      this.cache.invalidateUser(model);
    }
  }
  async invalidateRoleCache(role) {
    if (!this.cache) return;
    this.cache.invalidateRole(role);
  }
  async clearCache() {
    if (!this.cache) return;
    this.cache.clear();
  }
  isCacheEnabled() {
    return this.cache !== null;
  }
  cacheSize() {
    return this.cache?.size() ?? 0;
  }
};
function createAuth(opts) {
  if (!opts.resolver) {
    throw new Error("[permifyjs] resolver is required");
  }
  if (typeof opts.resolver.getRoles !== "function") {
    throw new Error(
      "[permifyjs] resolver.getRoles must be a function that returns Promise<string[]>"
    );
  }
  if (typeof opts.resolver.getDirectPermissions !== "function") {
    throw new Error(
      "[permifyjs] resolver.getDirectPermissions must be a function that returns Promise<string[]>"
    );
  }
  if (typeof opts.resolver.getPermissionsThroughRoles !== "function") {
    throw new Error(
      "[permifyjs] resolver.getPermissionsThroughRoles must be a function that returns Promise<string[]>"
    );
  }
  if (typeof opts.resolver.getRolePermissions !== "function") {
    throw new Error(
      "[permifyjs] resolver.getRolePermissions must be a function that returns Promise<string[]>"
    );
  }
  return new AuthEngine(opts);
}
function defineConfig(config) {
  return config;
}

// src/scope.ts
var DEFAULT_SCOPE_MODE = "tenant-team";
var INIT_DEFAULT_SCOPE_MODE = "global";
function normalizeScopeMode(scopeMode) {
  return scopeMode ?? DEFAULT_SCOPE_MODE;
}
function hasTenantScope(scopeMode) {
  const mode = normalizeScopeMode(scopeMode);
  return mode === "tenant" || mode === "tenant-team";
}
function hasTeamScope(scopeMode) {
  const mode = normalizeScopeMode(scopeMode);
  return mode === "team" || mode === "tenant-team";
}
function getEnabledScopeFields(scopeMode) {
  const fields = [];
  if (hasTenantScope(scopeMode)) {
    fields.push("tenantId");
  }
  if (hasTeamScope(scopeMode)) {
    fields.push("teamId");
  }
  return fields;
}

// src/seeding.ts
function unique(values) {
  return [...new Set(values ?? [])];
}
function normalizeRolePermissions(definition) {
  if (Array.isArray(definition)) {
    return unique(definition);
  }
  return unique(definition?.permissions);
}
function defineRoles(roles) {
  return roles;
}
async function seedRoles(auth, roles, options = {}) {
  const entries = Object.entries(roles);
  for (const [role, definition] of entries) {
    const permissions = normalizeRolePermissions(definition);
    for (const permission of permissions) {
      await auth.assignPermissionToRole(role, permission, options.context);
    }
  }
}
async function syncRolesAndPermissions(auth, roles, options = {}) {
  const entries = Object.entries(roles);
  for (const [role, definition] of entries) {
    const permissions = normalizeRolePermissions(definition);
    await auth.syncRolePermissions(role, permissions, options.context);
  }
}
async function bootstrapAccess(auth, options) {
  const roles = unique(options.roles);
  const permissions = unique(options.permissions);
  const mode = options.mode ?? "sync";
  if (mode === "merge") {
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
export {
  AuthEngine,
  DEFAULT_SCOPE_MODE,
  INIT_DEFAULT_SCOPE_MODE,
  MemoryCacheStore,
  PermissionCache,
  Role,
  bootstrapAccess,
  createAuth,
  defineConfig,
  defineRoles,
  getAllPermissions,
  getDirectPermissions,
  getEnabledScopeFields,
  getPermissionsThroughRoles,
  getRolePermissions,
  getRoles,
  hasAllDirectPermissions,
  hasAllPermissions,
  hasAllRoles,
  hasAnyDirectPermission,
  hasAnyPermission,
  hasAnyRole,
  hasAnyRoleOrPermission,
  hasExactRoles,
  hasRoleOrPermission,
  hasTeamScope,
  hasTenantScope,
  normalizeScopeMode,
  seedRoles,
  syncRolesAndPermissions
};

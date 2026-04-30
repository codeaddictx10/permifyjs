import type {
  CacheOptions,
  CacheEntry,
  RoleCacheEntry,
  CacheStore,
  CacheValue,
  AuthUser,
  AuthContext,
} from './types';

export class MemoryCacheStore<T = CacheValue> implements CacheStore<T> {
  private map = new Map<string, T>();

  get(key: string): T | null {
    return this.map.get(key) ?? null;
  }

  set(key: string, value: T): void {
    this.map.set(key, value);
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  keys(): Iterable<string> {
    return this.map.keys();
  }

  size(): number {
    return this.map.size;
  }
}

export class PermissionCache {
  private store: CacheStore<CacheValue>;
  private ttl: number;
  private max: number;
  private prefix: string;

  constructor(opts: CacheOptions = {}) {
    this.store = opts.store ?? new MemoryCacheStore();
    this.ttl = (opts.ttl ?? 60) * 1000;
    this.max = opts.max ?? 500;
    this.prefix = opts.prefix ?? 'permifyjs';
  }

  // ─── Key generation ───────────────────────────────────────────────

  buildKey(user: AuthUser, context?: AuthContext): string {
    const contextKey = context ? JSON.stringify(context) : 'default';
    return `${this.prefix}:${user.id}:${contextKey}`;
  }

  buildRoleKey(role: string, context?: AuthContext): string {
    const contextKey = context ? JSON.stringify(context) : 'default';
    return `${this.prefix}:role:${role}:${contextKey}`;
  }

  private userPrefix(user: AuthUser): string {
    return `${this.prefix}:${user.id}:`;
  }

  private rolePrefix(role: string): string {
    return `${this.prefix}:role:${role}:`;
  }

  private *filterKeys(prefix: string): Generator<string> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        yield key;
      }
    }
  }

  private *userKeys(): Generator<string> {
    for (const key of this.filterKeys(`${this.prefix}:`)) {
      if (!key.startsWith(`${this.prefix}:role:`)) {
        yield key;
      }
    }
  }

  private countKeys(keys: Iterable<string>): number {
    let count = 0;
    for (const _key of keys) {
      count += 1;
    }
    return count;
  }

  private evictOldest(keys: Iterable<string>): void {
    const oldestKey = keys[Symbol.iterator]().next().value;
    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }

  // ─── User cache ───────────────────────────────────────────────────

  get(user: AuthUser, context?: AuthContext): CacheEntry | null {
    const key = this.buildKey(user, context);
    const entry = this.store.get(key) as CacheEntry | null;

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry;
  }

  set(
    user: AuthUser,
    context: AuthContext | undefined,
    data: Omit<CacheEntry, 'expiresAt'>
  ): void {
    if (this.size() >= this.max) {
      this.evictOldest(this.userKeys());
    }

    const key = this.buildKey(user, context);
    this.store.set(key, {
      ...data,
      expiresAt: Date.now() + this.ttl,
    });
  }

  // ─── Role cache ───────────────────────────────────────────────────

  getRolePermissions(role: string, context?: AuthContext): string[] | null {
    const key = this.buildRoleKey(role, context);
    const entry = this.store.get(key) as RoleCacheEntry | null;

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.permissions;
  }

  setRolePermissions(
    role: string,
    context: AuthContext | undefined,
    permissions: string[]
  ): void {
    if (this.roleStoreSize() >= this.max) {
      this.evictOldest(this.filterKeys(`${this.prefix}:role:`));
    }

    const key = this.buildRoleKey(role, context);
    this.store.set(key, {
      permissions,
      expiresAt: Date.now() + this.ttl,
    });
  }

  invalidateRole(role: string): void {
    for (const key of this.filterKeys(this.rolePrefix(role))) {
      this.store.delete(key);
    }
  }

  // ─── User invalidation ────────────────────────────────────────────

  invalidateUser(user: AuthUser): void {
    for (const key of this.filterKeys(this.userPrefix(user))) {
      this.store.delete(key);
    }
  }

  invalidateUserContext(user: AuthUser, context?: AuthContext): void {
    const key = this.buildKey(user, context);
    this.store.delete(key);
  }

  // ─── Clear all ────────────────────────────────────────────────────

  clear(): void {
    this.store.clear();
  }

  // ─── Internals ────────────────────────────────────────────────────

  size(): number {
    return this.countKeys(this.userKeys());
  }

  roleStoreSize(): number {
    return this.countKeys(this.filterKeys(`${this.prefix}:role:`));
  }

  has(user: AuthUser, context?: AuthContext): boolean {
    return this.get(user, context) !== null;
  }
}

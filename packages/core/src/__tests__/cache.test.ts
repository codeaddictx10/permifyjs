import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuth } from '../engine';
import { MemoryCacheStore, PermissionCache } from '../cache';
import type { CacheStore, CacheValue } from '../types';

const baseResolver = {
  getRoles: async () => ['editor'],
  getDirectPermissions: async () => ['post.publish'],
  getPermissionsThroughRoles: async () => ['post.create'],
  getRolePermissions: async (role: string) => {
    const map: Record<string, string[]> = {
      editor: ['post.create', 'post.edit'],
      admin: ['post.create', 'post.edit', 'post.delete'],
    };
    return map[role] ?? [];
  },
};

// ─── PermissionCache unit tests ───────────────────────────────────

describe('PermissionCache', () => {
  let cache: PermissionCache;
  const user = { id: '1' };
  const entry = {
    roles: ['editor'],
    directPermissions: ['post.publish'],
    permissionsThroughRoles: ['post.create'],
  };

  beforeEach(() => {
    cache = new PermissionCache({ ttl: 60, max: 500 });
  });

  class SpyStore implements CacheStore<CacheValue> {
    private map = new Map<string, CacheValue>();
    readonly getSpy = vi.fn((key: string) => this.map.get(key) ?? null);
    readonly setSpy = vi.fn((key: string, value: CacheValue) => {
      this.map.set(key, value);
    });
    readonly deleteSpy = vi.fn((key: string) => {
      this.map.delete(key);
    });
    readonly clearSpy = vi.fn(() => {
      this.map.clear();
    });
    readonly keysSpy = vi.fn(() => this.map.keys());

    get(key: string): CacheValue | null {
      return this.getSpy(key);
    }

    set(key: string, value: CacheValue): void {
      this.setSpy(key, value);
    }

    delete(key: string): void {
      this.deleteSpy(key);
    }

    clear(): void {
      this.clearSpy();
    }

    keys(): Iterable<string> {
      return this.keysSpy();
    }
  }

  it('returns null for missing entry', () => {
    expect(cache.get(user)).toBeNull();
  });

  it('stores and retrieves an entry', () => {
    cache.set(user, undefined, entry);
    const result = cache.get(user);
    expect(result?.roles).toEqual(['editor']);
    expect(result?.directPermissions).toEqual(['post.publish']);
    expect(result?.permissionsThroughRoles).toEqual(['post.create']);
  });

  it('returns null for expired entry', async () => {
    const shortCache = new PermissionCache({ ttl: 0 });
    shortCache.set(user, undefined, entry);
    await new Promise((r) => setTimeout(r, 10));
    expect(shortCache.get(user)).toBeNull();
  });

  it('invalidates a specific user — all contexts', () => {
    cache.set(user, undefined, entry);
    cache.set(user, { teamId: 'team-1' }, entry);
    cache.invalidateUser(user);
    expect(cache.get(user)).toBeNull();
    expect(cache.get(user, { teamId: 'team-1' })).toBeNull();
  });

  it('invalidates a specific user + context only', () => {
    cache.set(user, undefined, entry);
    cache.set(user, { teamId: 'team-1' }, entry);
    cache.invalidateUserContext(user, { teamId: 'team-1' });
    expect(cache.get(user)).not.toBeNull();
    expect(cache.get(user, { teamId: 'team-1' })).toBeNull();
  });

  it('clears all user entries', () => {
    cache.set(user, undefined, entry);
    cache.set({ id: '2' }, undefined, entry);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('evicts oldest entry when at max capacity', () => {
    const smallCache = new PermissionCache({ max: 2 });
    smallCache.set({ id: '1' }, undefined, entry);
    smallCache.set({ id: '2' }, undefined, entry);
    smallCache.set({ id: '3' }, undefined, entry);
    expect(smallCache.size()).toBe(2);
  });

  it('generates different keys for different contexts', () => {
    cache.set(user, { teamId: 'team-1' }, entry);
    cache.set(user, { teamId: 'team-2' }, entry);
    expect(cache.size()).toBe(2);
  });

  it('uses the default in-memory store when no custom store is provided', () => {
    const memoryBackedCache = new PermissionCache();
    memoryBackedCache.set(user, undefined, entry);

    expect(memoryBackedCache.has(user)).toBe(true);
    expect(memoryBackedCache.size()).toBe(1);
  });

  // ─── Role cache ─────────────────────────────────────────────────

  it('stores and retrieves role permissions', () => {
    cache.setRolePermissions('editor', undefined, ['post.create', 'post.edit']);
    const result = cache.getRolePermissions('editor');
    expect(result).toEqual(['post.create', 'post.edit']);
  });

  it('returns null for missing role entry', () => {
    expect(cache.getRolePermissions('unknown')).toBeNull();
  });

  it('invalidates a specific role', () => {
    cache.setRolePermissions('editor', undefined, ['post.create']);
    cache.setRolePermissions('editor', { teamId: 'team-1' }, ['post.edit']);
    cache.invalidateRole('editor');
    expect(cache.getRolePermissions('editor')).toBeNull();
    expect(cache.getRolePermissions('editor', { teamId: 'team-1' })).toBeNull();
  });

  it('clear() also clears role store', () => {
    cache.setRolePermissions('editor', undefined, ['post.create']);
    cache.set(user, undefined, entry);
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.roleStoreSize()).toBe(0);
  });

  it('reads and writes through a custom store', () => {
    const store = new SpyStore();
    const customCache = new PermissionCache({ store });

    customCache.set(user, undefined, entry);

    expect(store.setSpy).toHaveBeenCalledTimes(1);
    expect(customCache.get(user)?.roles).toEqual(['editor']);
    expect(store.getSpy).toHaveBeenCalled();
  });

  it('invalidates entries in a custom store', () => {
    const store = new SpyStore();
    const customCache = new PermissionCache({ store });

    customCache.set(user, undefined, entry);
    customCache.setRolePermissions('editor', undefined, ['post.create']);

    customCache.invalidateUser(user);
    customCache.invalidateRole('editor');

    expect(customCache.get(user)).toBeNull();
    expect(customCache.getRolePermissions('editor')).toBeNull();
    expect(store.deleteSpy).toHaveBeenCalledTimes(2);
  });
});

// ─── AuthEngine cache integration ────────────────────────────────

describe('AuthEngine — caching', () => {
  it('does not use cache when not configured', async () => {
    const getDirectPermissions = vi.fn(async () => ['post.publish']);
    const auth = createAuth({
      resolver: {
        ...baseResolver,
        getDirectPermissions,
      },
    });

    const user = { id: '1' };
    await auth.can(user, 'post.publish');
    await auth.can(user, 'post.publish');

    expect(getDirectPermissions).toHaveBeenCalledTimes(2);
  });

  it('serves from cache on second call', async () => {
    const getDirectPermissions = vi.fn(async () => ['post.publish']);
    const auth = createAuth({
      resolver: {
        ...baseResolver,
        getDirectPermissions,
      },
      cache: { ttl: 60 },
    });

    const user = { id: '1' };
    await auth.can(user, 'post.publish');
    await auth.can(user, 'post.publish');

    expect(getDirectPermissions).toHaveBeenCalledTimes(1);
  });

  it('caches roles alongside permissions', async () => {
    const getRoles = vi.fn(async () => ['admin']);
    const auth = createAuth({
      resolver: {
        ...baseResolver,
        getRoles,
      },
      cache: { ttl: 60 },
    });

    const user = { id: '1' };
    await auth.hasRole(user, 'admin');
    await auth.hasRole(user, 'admin');

    expect(getRoles).toHaveBeenCalledTimes(1);
  });

  it('invalidateCache() clears user cache', async () => {
    const getDirectPermissions = vi.fn(async () => ['post.publish']);
    const auth = createAuth({
      resolver: {
        ...baseResolver,
        getDirectPermissions,
      },
      cache: { ttl: 60 },
    });

    const user = { id: '1' };
    await auth.can(user, 'post.publish');
    await auth.invalidateCache(user);
    await auth.can(user, 'post.publish');

    expect(getDirectPermissions).toHaveBeenCalledTimes(2);
  });

  it('invalidateCache() with context only clears that context', async () => {
    const getDirectPermissions = vi.fn(async () => ['post.publish']);
    const auth = createAuth({
      resolver: {
        ...baseResolver,
        getDirectPermissions,
      },
      cache: { ttl: 60 },
    });

    const user = { id: '1' };
    const ctx = { teamId: 'team-1' };

    await auth.can(user, 'post.publish');
    await auth.can(user, 'post.publish', ctx);
    await auth.invalidateCache(user, ctx);

    await auth.can(user, 'post.publish');
    await auth.can(user, 'post.publish', ctx);

    expect(getDirectPermissions).toHaveBeenCalledTimes(3);
  });

  it('clearCache() removes all entries', async () => {
    const getDirectPermissions = vi.fn(async () => ['post.publish']);
    const auth = createAuth({
      resolver: {
        ...baseResolver,
        getDirectPermissions,
      },
      cache: { ttl: 60 },
    });

    const user1 = { id: '1' };
    const user2 = { id: '2' };

    await auth.can(user1, 'post.publish');
    await auth.can(user2, 'post.publish');
    await auth.clearCache();
    await auth.can(user1, 'post.publish');
    await auth.can(user2, 'post.publish');

    expect(getDirectPermissions).toHaveBeenCalledTimes(4);
  });

  it('isCacheEnabled() returns correct state', () => {
    const withCache = createAuth({
      resolver: baseResolver,
      cache: { ttl: 60 },
    });
    const withoutCache = createAuth({ resolver: baseResolver });

    expect(withCache.isCacheEnabled()).toBe(true);
    expect(withoutCache.isCacheEnabled()).toBe(false);
  });

  it('respects ttl expiry', async () => {
    const getDirectPermissions = vi.fn(async () => ['post.publish']);
    const auth = createAuth({
      resolver: {
        ...baseResolver,
        getDirectPermissions,
      },
      cache: { ttl: 0 },
    });

    const user = { id: '1' };
    await auth.can(user, 'post.publish');
    await new Promise((r) => setTimeout(r, 10));
    await auth.can(user, 'post.publish');

    expect(getDirectPermissions).toHaveBeenCalledTimes(2);
  });

  it('caches separately per context', async () => {
    const getDirectPermissions = vi.fn(async () => ['post.publish']);
    const auth = createAuth({
      resolver: {
        ...baseResolver,
        getDirectPermissions,
      },
      cache: { ttl: 60 },
    });

    const user = { id: '1' };
    await auth.can(user, 'post.publish', { teamId: 'team-1' });
    await auth.can(user, 'post.publish', { teamId: 'team-2' });
    await auth.can(user, 'post.publish', { teamId: 'team-1' });
    await auth.can(user, 'post.publish', { teamId: 'team-2' });

    expect(getDirectPermissions).toHaveBeenCalledTimes(2);
  });

  it('invalidateRoleCache() forces resolver call again', async () => {
    const getRolePermissions = vi.fn(async () => ['post.create', 'post.edit']);
    const auth = createAuth({
      resolver: {
        ...baseResolver,
        getRolePermissions,
      },
      cache: { ttl: 60 },
    });

    const role = auth.role('editor');
    await role.getPermissions();
    await auth.invalidateRoleCache('editor');
    await role.getPermissions();

    expect(getRolePermissions).toHaveBeenCalledTimes(2);
  });

  it('supports engine caching through a supplied store', async () => {
    const store = new MemoryCacheStore();
    const getDirectPermissions = vi.fn(async () => ['post.publish']);
    const auth = createAuth({
      resolver: {
        ...baseResolver,
        getDirectPermissions,
      },
      cache: { ttl: 60, store },
    });

    const user = { id: '1' };
    await auth.can(user, 'post.publish');
    await auth.can(user, 'post.publish');

    expect(getDirectPermissions).toHaveBeenCalledTimes(1);
  });
});

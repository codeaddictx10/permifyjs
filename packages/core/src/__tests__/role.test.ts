import { describe, it, expect, vi } from 'vitest';
import { createAuth } from '../engine';
import { Role } from '../role';
import { PermissionCache } from '../cache';

const resolver = {
  getRoles: async () => ['editor', 'admin'],
  getDirectPermissions: async () => ['post.publish'],
  getPermissionsThroughRoles: async () => ['post.create', 'post.edit'],
  getRolePermissions: async (role: string) => {
    const map: Record<string, string[]> = {
      editor: ['post.create', 'post.edit'],
      admin: ['post.create', 'post.edit', 'post.delete', 'user.*'],
      viewer: ['post.view'],
    };
    return map[role] ?? [];
  },
};

const auth = createAuth({ resolver });

// ─── Role object ──────────────────────────────────────────────────

describe('Role — basic', () => {
  it('getName() returns role name', () => {
    const role = auth.role('editor');
    expect(role.getName()).toBe('editor');
  });

  it('getPermissions() returns role permissions', async () => {
    const role = auth.role('editor');
    const permissions = await role.getPermissions();
    expect(permissions).toEqual(['post.create', 'post.edit']);
  });

  it('getPermissions() returns empty for unknown role', async () => {
    const role = auth.role('unknown');
    const permissions = await role.getPermissions();
    expect(permissions).toEqual([]);
  });
});

// ─── hasPermissionTo ──────────────────────────────────────────────

describe('Role — hasPermissionTo()', () => {
  it('returns true for exact permission', async () => {
    const role = auth.role('editor');
    expect(await role.hasPermissionTo('post.create')).toBe(true);
  });

  it('returns false for missing permission', async () => {
    const role = auth.role('editor');
    expect(await role.hasPermissionTo('post.delete')).toBe(false);
  });

  it('supports wildcard permissions', async () => {
    const role = auth.role('admin');
    expect(await role.hasPermissionTo('user.create')).toBe(true);
    expect(await role.hasPermissionTo('user.delete')).toBe(true);
    expect(await role.hasPermissionTo('post.delete')).toBe(true);
  });

  it('wildcard does not match outside namespace', async () => {
    const role = auth.role('admin');
    expect(await role.hasPermissionTo('comment.create')).toBe(false);
  });
});

// ─── hasAnyPermission ─────────────────────────────────────────────

describe('Role — hasAnyPermission()', () => {
  it('returns true if any permission matches', async () => {
    const role = auth.role('editor');
    expect(
      await role.hasAnyPermission(['post.delete', 'post.create'])
    ).toBe(true);
  });

  it('returns false if no permissions match', async () => {
    const role = auth.role('editor');
    expect(
      await role.hasAnyPermission(['post.delete', 'user.create'])
    ).toBe(false);
  });
});

// ─── hasAllPermissions ────────────────────────────────────────────

describe('Role — hasAllPermissions()', () => {
  it('returns true if all permissions match', async () => {
    const role = auth.role('editor');
    expect(
      await role.hasAllPermissions(['post.create', 'post.edit'])
    ).toBe(true);
  });

  it('returns false if any permission is missing', async () => {
    const role = auth.role('editor');
    expect(
      await role.hasAllPermissions(['post.create', 'post.delete'])
    ).toBe(false);
  });
});

// ─── Role cache ───────────────────────────────────────────────────

describe('Role — caching', () => {
  it('caches role permissions after first call', async () => {
    const getRolePermissions = vi.fn(async (role: string) => {
      const map: Record<string, string[]> = {
        editor: ['post.create', 'post.edit'],
      };
      return map[role] ?? [];
    });

    const cachedAuth = createAuth({
      resolver: { ...resolver, getRolePermissions },
      cache: { ttl: 60 },
    });

    const role = cachedAuth.role('editor');
    await role.getPermissions();
    await role.getPermissions();

    expect(getRolePermissions).toHaveBeenCalledTimes(1);
  });

  it('invalidateRoleCache() forces resolver call again', async () => {
    const getRolePermissions = vi.fn(async (role: string) => {
      const map: Record<string, string[]> = {
        editor: ['post.create', 'post.edit'],
      };
      return map[role] ?? [];
    });

    const cachedAuth = createAuth({
      resolver: { ...resolver, getRolePermissions },
      cache: { ttl: 60 },
    });

    const role = cachedAuth.role('editor');
    await role.getPermissions();
    await cachedAuth.invalidateRoleCache('editor');
    await role.getPermissions();

    expect(getRolePermissions).toHaveBeenCalledTimes(2);
  });
});

// ─── Role via engine ──────────────────────────────────────────────

describe('AuthEngine — role()', () => {
  it('returns a Role instance', () => {
    const role = auth.role('editor');
    expect(role).toBeInstanceOf(Role);
  });

  it('role check works via engine', async () => {
    const role = auth.role('admin');
    expect(await role.hasPermissionTo('post.delete')).toBe(true);
    expect(await role.hasPermissionTo('post.create')).toBe(true);
  });
});

// ─── Resolver validation ──────────────────────────────────────────

describe('resolver validation — getRolePermissions', () => {
  it('throws if getRolePermissions is not a function', () => {
    expect(() =>
      createAuth({
        resolver: {
          getRoles: async () => [],
          getDirectPermissions: async () => [],
          getPermissionsThroughRoles: async () => [],
          getRolePermissions: 'not-a-function' as any,
        },
      })
    ).toThrow(
      '[permifyjs] resolver.getRolePermissions must be a function'
    );
  });

  it('throws at call time if getRolePermissions returns non-array', async () => {
    const badAuth = createAuth({
      resolver: {
        getRoles: async () => [],
        getDirectPermissions: async () => [],
        getPermissionsThroughRoles: async () => [],
        getRolePermissions: async () => null as any,
      },
    });

    const role = badAuth.role('editor');
    await expect(role.getPermissions()).rejects.toThrow(
      '[permifyjs] resolver.getRolePermissions must return Promise<string[]>'
    );
  });
});

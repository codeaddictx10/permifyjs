import { describe, it, expect } from 'vitest';
import { createAuth } from '../engine';

const resolver = {
  getRoles: async () => ['editor'],
  getDirectPermissions: async () => ['post.publish'],
  getPermissionsThroughRoles: async () => ['post.create', 'post.edit'],
  getRolePermissions: async (role: string) => {
    const map: Record<string, string[]> = {
      editor: ['post.create', 'post.edit'],
      admin: ['post.create', 'post.edit', 'post.delete', 'user.*'],
    };
    return map[role] ?? [];
  },
};

const auth = createAuth({ resolver });
const user = { id: '1' };

// ─── Merged permissions ───────────────────────────────────────────

describe('merged permissions', () => {
  it('can() resolves direct permission', async () => {
    expect(await auth.can(user, 'post.publish')).toBe(true);
  });

  it('can() resolves role permission', async () => {
    expect(await auth.can(user, 'post.create')).toBe(true);
  });

  it('can() returns false for unknown permission', async () => {
    expect(await auth.can(user, 'post.delete')).toBe(false);
  });

  it('canDirectly() only checks direct permissions', async () => {
    expect(await auth.canDirectly(user, 'post.publish')).toBe(true);
    expect(await auth.canDirectly(user, 'post.create')).toBe(false);
  });

  it('canThroughRole() only checks role permissions', async () => {
    expect(await auth.canThroughRole(user, 'post.create')).toBe(true);
    expect(await auth.canThroughRole(user, 'post.publish')).toBe(false);
  });

  it('getAllPermissions() merges and deduplicates', async () => {
    const all = await auth.getAllPermissions(user);
    expect(all).toEqual(
      expect.arrayContaining(['post.publish', 'post.create', 'post.edit'])
    );
    expect(new Set(all).size).toBe(all.length);
  });
});

// ─── Wildcard permissions ─────────────────────────────────────────

describe('wildcard permissions', () => {
  describe('full wildcard (*)', () => {
    const wildcardAuth = createAuth({
      resolver: {
        getRoles: async () => [],
        getDirectPermissions: async () => ['*'],
        getPermissionsThroughRoles: async () => [],
        getRolePermissions: async () => [],
      },
    });

    it('* matches any permission', async () => {
      expect(await wildcardAuth.can(user, 'post.create')).toBe(true);
      expect(await wildcardAuth.can(user, 'user.delete')).toBe(true);
      expect(await wildcardAuth.can(user, 'anything')).toBe(true);
    });
  });

  describe('namespace wildcard (post.*)', () => {
    const wildcardAuth = createAuth({
      resolver: {
        getRoles: async () => [],
        getDirectPermissions: async () => ['post.*'],
        getPermissionsThroughRoles: async () => [],
        getRolePermissions: async () => [],
      },
    });

    it('post.* matches all post permissions', async () => {
      expect(await wildcardAuth.can(user, 'post.create')).toBe(true);
      expect(await wildcardAuth.can(user, 'post.edit')).toBe(true);
      expect(await wildcardAuth.can(user, 'post.delete')).toBe(true);
      expect(await wildcardAuth.can(user, 'post.publish')).toBe(true);
    });

    it('post.* does not match other namespaces', async () => {
      expect(await wildcardAuth.can(user, 'user.create')).toBe(false);
      expect(await wildcardAuth.can(user, 'comment.edit')).toBe(false);
    });
  });

  describe('action wildcard (*.create)', () => {
    const wildcardAuth = createAuth({
      resolver: {
        getRoles: async () => [],
        getDirectPermissions: async () => ['*.create'],
        getPermissionsThroughRoles: async () => [],
        getRolePermissions: async () => [],
      },
    });

    it('*.create matches create on any resource', async () => {
      expect(await wildcardAuth.can(user, 'post.create')).toBe(true);
      expect(await wildcardAuth.can(user, 'user.create')).toBe(true);
      expect(await wildcardAuth.can(user, 'comment.create')).toBe(true);
    });

    it('*.create does not match other actions', async () => {
      expect(await wildcardAuth.can(user, 'post.edit')).toBe(false);
      expect(await wildcardAuth.can(user, 'user.delete')).toBe(false);
    });
  });

  describe('wildcard through roles', () => {
    const wildcardAuth = createAuth({
      resolver: {
        getRoles: async () => ['admin'],
        getDirectPermissions: async () => [],
        getPermissionsThroughRoles: async () => ['post.*'],
        getRolePermissions: async () => ['post.*'],
      },
    });

    it('wildcard inherited through role works', async () => {
      expect(await wildcardAuth.can(user, 'post.create')).toBe(true);
      expect(await wildcardAuth.can(user, 'post.delete')).toBe(true);
    });

    it('canThroughRole() respects wildcard', async () => {
      expect(await wildcardAuth.canThroughRole(user, 'post.create')).toBe(true);
      expect(await wildcardAuth.canThroughRole(user, 'user.create')).toBe(false);
    });

    it('canDirectly() does not match role wildcard', async () => {
      expect(await wildcardAuth.canDirectly(user, 'post.create')).toBe(false);
    });
  });

  describe('mixed exact and wildcard', () => {
    const mixedAuth = createAuth({
      resolver: {
        getRoles: async () => [],
        getDirectPermissions: async () => ['post.*', 'user.view'],
        getPermissionsThroughRoles: async () => [],
        getRolePermissions: async () => [],
      },
    });

    it('matches wildcard permission', async () => {
      expect(await mixedAuth.can(user, 'post.create')).toBe(true);
    });

    it('matches exact permission alongside wildcard', async () => {
      expect(await mixedAuth.can(user, 'user.view')).toBe(true);
    });

    it('does not match outside wildcard or exact', async () => {
      expect(await mixedAuth.can(user, 'user.delete')).toBe(false);
    });
  });
});

// ─── Roles ───────────────────────────────────────────────────────

describe('roles', () => {
  it('hasRole() returns true for valid role', async () => {
    expect(await auth.hasRole(user, 'editor')).toBe(true);
  });

  it('hasRole() returns false for invalid role', async () => {
    expect(await auth.hasRole(user, 'admin')).toBe(false);
  });
});

// ─── beforeCheck hook ─────────────────────────────────────────────

describe('beforeCheck hook', () => {
  it('super admin bypasses all checks', async () => {
    const superAuth = createAuth({
      resolver,
      beforeCheck: ({ model }) =>
        (model as any).isSuperAdmin ? true : null,
    });
    expect(
      await superAuth.can({ id: '1', isSuperAdmin: true }, 'anything')
    ).toBe(true);
  });

  it('null from beforeCheck falls through to resolver', async () => {
    const superAuth = createAuth({
      resolver,
      beforeCheck: () => null,
    });
    expect(await superAuth.can(user, 'post.publish')).toBe(true);
    expect(await superAuth.can(user, 'post.delete')).toBe(false);
  });

  it('false from beforeCheck explicitly denies', async () => {
    const denyAuth = createAuth({
      resolver,
      beforeCheck: () => false,
    });
    expect(await denyAuth.can(user, 'post.publish')).toBe(false);
  });
});

// ─── Resolver validation ──────────────────────────────────────────

describe('resolver validation', () => {
  it('throws if resolver is missing', () => {
    expect(() =>
      createAuth({ resolver: null as any })
    ).toThrow('[permifyjs] resolver is required');
  });

  it('throws if getRoles is not a function', () => {
    expect(() =>
      createAuth({
        resolver: {
          getRoles: 'not-a-function' as any,
          getDirectPermissions: async () => [],
          getPermissionsThroughRoles: async () => [],
          getRolePermissions: async () => [],
        },
      })
    ).toThrow('[permifyjs] resolver.getRoles must be a function');
  });

  it('throws if getDirectPermissions is not a function', () => {
    expect(() =>
      createAuth({
        resolver: {
          getRoles: async () => [],
          getDirectPermissions: 'not-a-function' as any,
          getPermissionsThroughRoles: async () => [],
          getRolePermissions: async () => [],
        },
      })
    ).toThrow('[permifyjs] resolver.getDirectPermissions must be a function');
  });

  it('throws if getPermissionsThroughRoles is not a function', () => {
    expect(() =>
      createAuth({
        resolver: {
          getRoles: async () => [],
          getDirectPermissions: async () => [],
          getPermissionsThroughRoles: 'not-a-function' as any,
          getRolePermissions: async () => [],
        },
      })
    ).toThrow(
      '[permifyjs] resolver.getPermissionsThroughRoles must be a function'
    );
  });

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

  it('throws at call time if getDirectPermissions returns non-array', async () => {
    const auth = createAuth({
      resolver: {
        getRoles: async () => [],
        getDirectPermissions: async () => null as any,
        getPermissionsThroughRoles: async () => [],
        getRolePermissions: async () => [],
      },
    });
    await expect(
      auth.can({ id: '1' }, 'post.create')
    ).rejects.toThrow(
      '[permifyjs] resolver.getDirectPermissions must return Promise<string[]>'
    );
  });

  it('throws at call time if getPermissionsThroughRoles returns non-array', async () => {
    const auth = createAuth({
      resolver: {
        getRoles: async () => [],
        getDirectPermissions: async () => [],
        getPermissionsThroughRoles: async () => null as any,
        getRolePermissions: async () => [],
      },
    });
    await expect(
      auth.can({ id: '1' }, 'post.create')
    ).rejects.toThrow(
      '[permifyjs] resolver.getPermissionsThroughRoles must return Promise<string[]>'
    );
  });
});

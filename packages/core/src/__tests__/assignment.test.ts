import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuth } from '../engine';
import type { PermissionWriteResolver, AuthUser, AuthContext } from '../types';

// ─── In-memory write resolver ─────────────────────────────────────

function createInMemoryWriteResolver() {
  const userRoles: Record<string, string[]> = {
    '1': ['editor'],
    '2': [],
    '3': [],
  };

  const userPermissions: Record<string, string[]> = {
    '1': ['post.publish'],
    '2': [],
    '3': [],
  };

  const rolePermissions: Record<string, string[]> = {
    editor: ['post.create', 'post.edit'],
    admin: ['post.create', 'post.edit', 'post.delete'],
  };

  const resolver = {
    getRoles: async (user: AuthUser) => userRoles[user.id] ?? [],
    getDirectPermissions: async (user: AuthUser) =>
      userPermissions[user.id] ?? [],
    getPermissionsThroughRoles: async (user: AuthUser) => {
      const roles = userRoles[user.id] ?? [];
      return roles.flatMap((r) => rolePermissions[r] ?? []);
    },
    getRolePermissions: async (role: string) => rolePermissions[role] ?? [],
  };

  const writeResolver: PermissionWriteResolver = {
    // ─── User role assignment ───────────────────────────────────────
    assignRole: vi.fn(async (user: AuthUser, role: string) => {
      if (!userRoles[user.id]) userRoles[user.id] = [];
      if (!userRoles[user.id].includes(role)) {
        userRoles[user.id].push(role);
      }
    }),

    removeRole: vi.fn(async (user: AuthUser, role: string) => {
      if (userRoles[user.id]) {
        userRoles[user.id] = userRoles[user.id].filter((r) => r !== role);
      }
    }),

    syncRoles: vi.fn(async (user: AuthUser, roles: string[]) => {
      userRoles[user.id] = [...roles];
    }),

    // ─── User direct permission assignment ─────────────────────────
    givePermissionTo: vi.fn(async (user: AuthUser, permission: string) => {
      if (!userPermissions[user.id]) userPermissions[user.id] = [];
      if (!userPermissions[user.id].includes(permission)) {
        userPermissions[user.id].push(permission);
      }
    }),

    revokePermissionTo: vi.fn(async (user: AuthUser, permission: string) => {
      if (userPermissions[user.id]) {
        userPermissions[user.id] = userPermissions[user.id].filter(
          (p) => p !== permission
        );
      }
    }),

    syncPermissions: vi.fn(async (user: AuthUser, permissions: string[]) => {
      userPermissions[user.id] = [...permissions];
    }),

    // ─── Role permission assignment ─────────────────────────────────
    assignPermissionToRole: vi.fn(async (role: string, permission: string) => {
      if (!rolePermissions[role]) rolePermissions[role] = [];
      if (!rolePermissions[role].includes(permission)) {
        rolePermissions[role].push(permission);
      }
    }),

    revokePermissionFromRole: vi.fn(async (role: string, permission: string) => {
      if (rolePermissions[role]) {
        rolePermissions[role] = rolePermissions[role].filter(
          (p) => p !== permission
        );
      }
    }),

    syncRolePermissions: vi.fn(async (role: string, permissions: string[]) => {
      rolePermissions[role] = [...permissions];
    }),
  };

  return { resolver, writeResolver, userRoles, userPermissions, rolePermissions };
}

// ─── Tests ────────────────────────────────────────────────────────

describe('assignment methods — no writeResolver', () => {
  const resolver = {
    getRoles: async () => [],
    getDirectPermissions: async () => [],
    getPermissionsThroughRoles: async () => [],
    getRolePermissions: async () => [],
  };

  const auth = createAuth({ resolver });
  const user = { id: '1' };

  it('assignRole() throws without writeResolver', async () => {
    await expect(auth.assignRole(user, 'editor')).rejects.toThrow(
      '[permifyjs] writeResolver is required to use assignRole()'
    );
  });

  it('removeRole() throws without writeResolver', async () => {
    await expect(auth.removeRole(user, 'editor')).rejects.toThrow(
      '[permifyjs] writeResolver is required to use removeRole()'
    );
  });

  it('syncRoles() throws without writeResolver', async () => {
    await expect(auth.syncRoles(user, ['editor'])).rejects.toThrow(
      '[permifyjs] writeResolver is required to use syncRoles()'
    );
  });

  it('givePermissionTo() throws without writeResolver', async () => {
    await expect(auth.givePermissionTo(user, 'post.create')).rejects.toThrow(
      '[permifyjs] writeResolver is required to use givePermissionTo()'
    );
  });

  it('revokePermissionTo() throws without writeResolver', async () => {
    await expect(auth.revokePermissionTo(user, 'post.create')).rejects.toThrow(
      '[permifyjs] writeResolver is required to use revokePermissionTo()'
    );
  });

  it('syncPermissions() throws without writeResolver', async () => {
    await expect(
      auth.syncPermissions(user, ['post.create'])
    ).rejects.toThrow(
      '[permifyjs] writeResolver is required to use syncPermissions()'
    );
  });

  it('assignPermissionToRole() throws without writeResolver', async () => {
    await expect(
      auth.assignPermissionToRole('editor', 'post.create')
    ).rejects.toThrow(
      '[permifyjs] writeResolver is required to use assignPermissionToRole()'
    );
  });

  it('revokePermissionFromRole() throws without writeResolver', async () => {
    await expect(
      auth.revokePermissionFromRole('editor', 'post.create')
    ).rejects.toThrow(
      '[permifyjs] writeResolver is required to use revokePermissionFromRole()'
    );
  });

  it('syncRolePermissions() throws without writeResolver', async () => {
    await expect(
      auth.syncRolePermissions('editor', ['post.create'])
    ).rejects.toThrow(
      '[permifyjs] writeResolver is required to use syncRolePermissions()'
    );
  });
});

// ─── User role assignment ─────────────────────────────────────────

describe('assignRole()', () => {
  it('assigns a role to a user', async () => {
    const { resolver, writeResolver } = createInMemoryWriteResolver();
    const auth = createAuth({ resolver, writeResolver });
    const user = { id: '2' };

    await auth.assignRole(user, 'editor');

    expect(writeResolver.assignRole).toHaveBeenCalledWith(
      { ...user, modelType: 'User' },
      'editor',
      undefined
    );
    expect(await auth.hasRole(user, 'editor')).toBe(true);
  });

  it('does not duplicate role on double assign', async () => {
    const { resolver, writeResolver, userRoles } =
      createInMemoryWriteResolver();
    const auth = createAuth({ resolver, writeResolver });
    const user = { id: '1' };

    await auth.assignRole(user, 'editor');
    await auth.assignRole(user, 'editor');

    expect(userRoles['1'].filter((r) => r === 'editor').length).toBe(1);
  });

  it('supports context', async () => {
    const { resolver, writeResolver } = createInMemoryWriteResolver();
    const auth = createAuth({ resolver, writeResolver });
    const user = { id: '2' };
    const ctx: AuthContext = { teamId: 'team-1' };

    await auth.assignRole(user, 'editor', ctx);

    expect(writeResolver.assignRole).toHaveBeenCalledWith(
      { ...user, modelType: 'User' },
      'editor',
      ctx
    );
  });
});

describe('removeRole()', () => {
  it('removes a role from a user', async () => {
    const { resolver, writeResolver } = createInMemoryWriteResolver();
    const auth = createAuth({ resolver, writeResolver });
    const user = { id: '1' };

    expect(await auth.hasRole(user, 'editor')).toBe(true);
    await auth.removeRole(user, 'editor');
    expect(await auth.hasRole(user, 'editor')).toBe(false);
  });

  it('does not throw when removing non-existent role', async () => {
    const { resolver, writeResolver } = createInMemoryWriteResolver();
    const auth = createAuth({ resolver, writeResolver });
    const user = { id: '2' };

    await expect(auth.removeRole(user, 'admin')).resolves.not.toThrow();
  });
});

describe('syncRoles()', () => {
  it('replaces all roles with new set', async () => {
    const { resolver, writeResolver } = createInMemoryWriteResolver();
    const auth = createAuth({ resolver, writeResolver });
    const user = { id: '1' };

    await auth.syncRoles(user, ['admin']);

    expect(await auth.hasRole(user, 'admin')).toBe(true);
    expect(await auth.hasRole(user, 'editor')).toBe(false);
  });

  it('can sync to empty roles', async () => {
    const { resolver, writeResolver } = createInMemoryWriteResolver();
    const auth = createAuth({ resolver, writeResolver });
    const user = { id: '1' };

    await auth.syncRoles(user, []);

    expect(await auth.hasRole(user, 'editor')).toBe(false);
  });
});

// ─── User direct permission assignment ────────────────────────────

describe('givePermissionTo()', () => {
  it('gives a direct permission to a user', async () => {
    const { resolver, writeResolver } = createInMemoryWriteResolver();
    const auth = createAuth({ resolver, writeResolver });
    const user = { id: '2' };

    await auth.givePermissionTo(user, 'post.publish');

    expect(writeResolver.givePermissionTo).toHaveBeenCalledWith(
      { ...user, modelType: 'User' },
      'post.publish',
      undefined
    );
    expect(await auth.canDirectly(user, 'post.publish')).toBe(true);
  });

  it('does not duplicate permission on double assign', async () => {
    const { resolver, writeResolver, userPermissions } =
      createInMemoryWriteResolver();
    const auth = createAuth({ resolver, writeResolver });
    const user = { id: '1' };

    await auth.givePermissionTo(user, 'post.publish');
    await auth.givePermissionTo(user, 'post.publish');

    expect(
      userPermissions['1'].filter((p) => p === 'post.publish').length
    ).toBe(1);
  });
});

describe('revokePermissionTo()', () => {
  it('revokes a direct permission from a user', async () => {
    const { resolver, writeResolver } = createInMemoryWriteResolver();
    const auth = createAuth({ resolver, writeResolver });
    const user = { id: '1' };

    expect(await auth.canDirectly(user, 'post.publish')).toBe(true);
    await auth.revokePermissionTo(user, 'post.publish');
    expect(await auth.canDirectly(user, 'post.publish')).toBe(false);
  });

  it('does not throw when revoking non-existent permission', async () => {
    const { resolver, writeResolver } = createInMemoryWriteResolver();
    const auth = createAuth({ resolver, writeResolver });
    const user = { id: '2' };

    await expect(
      auth.revokePermissionTo(user, 'post.publish')
    ).resolves.not.toThrow();
  });
});

describe('syncPermissions()', () => {
  it('replaces all direct permissions with new set', async () => {
    const { resolver, writeResolver } = createInMemoryWriteResolver();
    const auth = createAuth({ resolver, writeResolver });
    const user = { id: '1' };

    await auth.syncPermissions(user, ['user.view', 'user.edit']);

    expect(await auth.canDirectly(user, 'user.view')).toBe(true);
    expect(await auth.canDirectly(user, 'user.edit')).toBe(true);
    expect(await auth.canDirectly(user, 'post.publish')).toBe(false);
  });

  it('can sync to empty permissions', async () => {
    const { resolver, writeResolver } = createInMemoryWriteResolver();
    const auth = createAuth({ resolver, writeResolver });
    const user = { id: '1' };

    await auth.syncPermissions(user, []);

    expect(await auth.canDirectly(user, 'post.publish')).toBe(false);
  });
});

// ─── Role permission assignment ───────────────────────────────────

describe('assignPermissionToRole()', () => {
  it('assigns a permission to a role', async () => {
    const { resolver, writeResolver } = createInMemoryWriteResolver();
    const auth = createAuth({ resolver, writeResolver });

    await auth.assignPermissionToRole('editor', 'post.delete');

    expect(writeResolver.assignPermissionToRole).toHaveBeenCalledWith(
      'editor',
      'post.delete',
      undefined
    );

    const role = auth.role('editor');
    expect(await role.hasPermissionTo('post.delete')).toBe(true);
  });

  it('does not duplicate permission on double assign', async () => {
    const { resolver, writeResolver, rolePermissions } =
      createInMemoryWriteResolver();
    const auth = createAuth({ resolver, writeResolver });

    await auth.assignPermissionToRole('editor', 'post.delete');
    await auth.assignPermissionToRole('editor', 'post.delete');

    expect(
      rolePermissions['editor'].filter((p) => p === 'post.delete').length
    ).toBe(1);
  });
});

describe('revokePermissionFromRole()', () => {
  it('revokes a permission from a role', async () => {
    const { resolver, writeResolver } = createInMemoryWriteResolver();
    const auth = createAuth({ resolver, writeResolver });

    const role = auth.role('editor');
    expect(await role.hasPermissionTo('post.edit')).toBe(true);

    await auth.revokePermissionFromRole('editor', 'post.edit');

    expect(await role.hasPermissionTo('post.edit')).toBe(false);
  });

  it('does not throw when revoking non-existent permission', async () => {
    const { resolver, writeResolver } = createInMemoryWriteResolver();
    const auth = createAuth({ resolver, writeResolver });

    await expect(
      auth.revokePermissionFromRole('editor', 'post.delete')
    ).resolves.not.toThrow();
  });
});

describe('syncRolePermissions()', () => {
  it('replaces all role permissions with new set', async () => {
    const { resolver, writeResolver } = createInMemoryWriteResolver();
    const auth = createAuth({ resolver, writeResolver });

    await auth.syncRolePermissions('editor', ['post.view', 'post.publish']);

    const role = auth.role('editor');
    expect(await role.hasPermissionTo('post.view')).toBe(true);
    expect(await role.hasPermissionTo('post.publish')).toBe(true);
    expect(await role.hasPermissionTo('post.create')).toBe(false);
    expect(await role.hasPermissionTo('post.edit')).toBe(false);
  });

  it('can sync to empty permissions', async () => {
    const { resolver, writeResolver } = createInMemoryWriteResolver();
    const auth = createAuth({ resolver, writeResolver });

    await auth.syncRolePermissions('editor', []);

    const role = auth.role('editor');
    expect(await role.hasPermissionTo('post.create')).toBe(false);
  });
});

// ─── Cache invalidation after writes ─────────────────────────────

describe('cache invalidation after assignment', () => {
  it('invalidates user cache after assignRole()', async () => {
    const { resolver, writeResolver } = createInMemoryWriteResolver();
    const getDirectPermissions = vi.fn(resolver.getDirectPermissions);

    const auth = createAuth({
      resolver: { ...resolver, getDirectPermissions },
      writeResolver,
      cache: { ttl: 60 },
    });

    const user = { id: '2' };
    await auth.can(user, 'post.create');  // cached
    await auth.assignRole(user, 'editor'); // invalidates cache
    await auth.can(user, 'post.create');  // re-fetched

    expect(getDirectPermissions).toHaveBeenCalledTimes(2);
  });

  it('invalidates role cache after assignPermissionToRole()', async () => {
    const { resolver, writeResolver } = createInMemoryWriteResolver();
    const getRolePermissions = vi.fn(resolver.getRolePermissions);

    const auth = createAuth({
      resolver: { ...resolver, getRolePermissions },
      writeResolver,
      cache: { ttl: 60 },
    });

    const role = auth.role('editor');
    await role.getPermissions();                         // cached
    await auth.assignPermissionToRole('editor', 'post.delete'); // invalidates
    await role.getPermissions();                         // re-fetched

    expect(getRolePermissions).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  bootstrapAccess,
  defineRoles,
  seedRoles,
  syncRolesAndPermissions,
} from '../seeding';

describe('defineRoles()', () => {
  it('returns the same role map for DX-friendly authoring', () => {
    const roles = defineRoles({
      admin: ['posts.create', 'posts.delete'],
      editor: { permissions: ['posts.update'] },
    });

    expect(roles).toEqual({
      admin: ['posts.create', 'posts.delete'],
      editor: { permissions: ['posts.update'] },
    });
  });
});

describe('seedRoles()', () => {
  it('assigns each permission to each role', async () => {
    const auth = {
      assignPermissionToRole: vi.fn(async () => undefined),
      syncRolePermissions: vi.fn(async () => undefined),
    };

    await seedRoles(auth as any, {
      admin: ['posts.create', 'posts.delete', 'posts.create'],
      editor: { permissions: ['posts.update'] },
    });

    expect(auth.assignPermissionToRole).toHaveBeenCalledTimes(3);
    expect(auth.assignPermissionToRole).toHaveBeenNthCalledWith(
      1,
      'admin',
      'posts.create',
      undefined
    );
    expect(auth.assignPermissionToRole).toHaveBeenNthCalledWith(
      2,
      'admin',
      'posts.delete',
      undefined
    );
    expect(auth.assignPermissionToRole).toHaveBeenNthCalledWith(
      3,
      'editor',
      'posts.update',
      undefined
    );
  });

  it('passes context through to assignment calls', async () => {
    const auth = {
      assignPermissionToRole: vi.fn(async () => undefined),
      syncRolePermissions: vi.fn(async () => undefined),
    };
    const context = { teamId: 'team-1' };

    await seedRoles(
      auth as any,
      {
        admin: ['posts.create'],
      },
      { context }
    );

    expect(auth.assignPermissionToRole).toHaveBeenCalledWith(
      'admin',
      'posts.create',
      context
    );
  });

  it('skips empty role definitions', async () => {
    const auth = {
      assignPermissionToRole: vi.fn(async () => undefined),
      syncRolePermissions: vi.fn(async () => undefined),
    };

    await seedRoles(auth as any, {
      viewer: [],
      guest: { permissions: [] },
    });

    expect(auth.assignPermissionToRole).not.toHaveBeenCalled();
  });
});

describe('syncRolesAndPermissions()', () => {
  it('syncs each role with a deduplicated permission set', async () => {
    const auth = {
      assignPermissionToRole: vi.fn(async () => undefined),
      syncRolePermissions: vi.fn(async () => undefined),
    };

    await syncRolesAndPermissions(auth as any, {
      admin: ['posts.create', 'posts.delete', 'posts.create'],
      viewer: { permissions: ['posts.view'] },
      guest: [],
    });

    expect(auth.syncRolePermissions).toHaveBeenCalledTimes(3);
    expect(auth.syncRolePermissions).toHaveBeenNthCalledWith(
      1,
      'admin',
      ['posts.create', 'posts.delete'],
      undefined
    );
    expect(auth.syncRolePermissions).toHaveBeenNthCalledWith(
      2,
      'viewer',
      ['posts.view'],
      undefined
    );
    expect(auth.syncRolePermissions).toHaveBeenNthCalledWith(
      3,
      'guest',
      [],
      undefined
    );
  });
});

describe('bootstrapAccess()', () => {
  it('syncs model roles and permissions by default', async () => {
    const auth = {
      assignRole: vi.fn(async () => undefined),
      givePermissionTo: vi.fn(async () => undefined),
      syncRoles: vi.fn(async () => undefined),
      syncPermissions: vi.fn(async () => undefined),
    };
    const model = { id: '1', modelType: 'User' };
    const context = { tenantId: 'tenant-1' };

    await bootstrapAccess(auth as any, {
      model,
      roles: ['admin', 'admin'],
      permissions: ['posts.create', 'posts.create'],
      context,
    });

    expect(auth.syncRoles).toHaveBeenCalledWith(model, ['admin'], context);
    expect(auth.syncPermissions).toHaveBeenCalledWith(
      model,
      ['posts.create'],
      context
    );
    expect(auth.assignRole).not.toHaveBeenCalled();
    expect(auth.givePermissionTo).not.toHaveBeenCalled();
  });

  it('merges model roles and permissions when requested', async () => {
    const auth = {
      assignRole: vi.fn(async () => undefined),
      givePermissionTo: vi.fn(async () => undefined),
      syncRoles: vi.fn(async () => undefined),
      syncPermissions: vi.fn(async () => undefined),
    };
    const model = { id: '1' };

    await bootstrapAccess(auth as any, {
      model,
      roles: ['editor', 'editor'],
      permissions: ['posts.publish', 'posts.publish'],
      mode: 'merge',
    });

    expect(auth.assignRole).toHaveBeenCalledTimes(1);
    expect(auth.assignRole).toHaveBeenCalledWith(model, 'editor', undefined);
    expect(auth.givePermissionTo).toHaveBeenCalledTimes(1);
    expect(auth.givePermissionTo).toHaveBeenCalledWith(
      model,
      'posts.publish',
      undefined
    );
    expect(auth.syncRoles).not.toHaveBeenCalled();
    expect(auth.syncPermissions).not.toHaveBeenCalled();
  });

  it('handles empty bootstrap sets without failing', async () => {
    const auth = {
      assignRole: vi.fn(async () => undefined),
      givePermissionTo: vi.fn(async () => undefined),
      syncRoles: vi.fn(async () => undefined),
      syncPermissions: vi.fn(async () => undefined),
    };

    await bootstrapAccess(auth as any, {
      model: { id: '2' },
    });

    expect(auth.syncRoles).toHaveBeenCalledWith({ id: '2' }, [], undefined);
    expect(auth.syncPermissions).toHaveBeenCalledWith(
      { id: '2' },
      [],
      undefined
    );
  });
});

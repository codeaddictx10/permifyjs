import { describe, expect, it, vi } from 'vitest';
import { createPrismaResolver } from '../resolver';
import { createPrismaWriteResolver } from '../writeResolver';

const GLOBAL_SCOPE = '__permify_global__';

describe('@permifyjs/prisma scope modes', () => {
  it('omits scope fields entirely in global mode', async () => {
    const permifyModelHasRole = {
      findMany: vi.fn().mockResolvedValue([{ role: { name: 'admin' } }]),
    };
    const permifyRole = {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'role-1' }),
    };
    const permifyModelHasPermission = { findMany: vi.fn().mockResolvedValue([]) };
    const permifyRoleHasPermission = { findMany: vi.fn().mockResolvedValue([]) };
    const permifyModelHasRoleWriter = {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    };
    const permifyPermission = {
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    };
    const permifyModelHasPermissionWriter = {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    };
    const permifyRoleHasPermissionWriter = {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    };

    const resolver = createPrismaResolver(
      {
        permifyModelHasRole,
        permifyModelHasPermission,
        permifyRole: { findUnique: vi.fn().mockResolvedValue(null) },
        permifyRoleHasPermission,
      } as any,
      { scopeMode: 'global' }
    );
    const writeResolver = createPrismaWriteResolver(
      {
        permifyRole,
        permifyPermission,
        permifyModelHasRole: permifyModelHasRoleWriter,
        permifyModelHasPermission: permifyModelHasPermissionWriter,
        permifyRoleHasPermission: permifyRoleHasPermissionWriter,
      } as any,
      { scopeMode: 'global' }
    );

    expect(await resolver.getRoles({ id: 'user-1' })).toEqual(['admin']);
    expect(permifyModelHasRole.findMany).toHaveBeenCalledWith({
      where: {
        modelId: 'user-1',
        modelType: 'User',
      },
      include: { role: true },
    });

    await writeResolver.assignRole({ id: 'user-1' }, 'admin');
    expect(permifyModelHasRoleWriter.upsert).toHaveBeenCalledWith({
      where: {
        modelId_modelType_roleId: {
          modelId: 'user-1',
          modelType: 'User',
          roleId: 'role-1',
        },
      },
      create: {
        modelId: 'user-1',
        modelType: 'User',
        roleId: 'role-1',
      },
      update: {},
    });
  });

  it('uses only tenant scope in tenant mode', async () => {
    const permifyModelHasPermission = {
      findMany: vi.fn().mockResolvedValue([{ permission: { name: 'post.publish' } }]),
    };
    const permifyPermission = {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'permission-1' }),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    };
    const permifyModelHasPermissionWriter = {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    };

    const resolver = createPrismaResolver(
      {
        permifyModelHasRole: { findMany: vi.fn().mockResolvedValue([]) },
        permifyModelHasPermission,
        permifyRole: { findUnique: vi.fn().mockResolvedValue(null) },
        permifyRoleHasPermission: { findMany: vi.fn().mockResolvedValue([]) },
      } as any,
      { scopeMode: 'tenant' }
    );
    const writeResolver = createPrismaWriteResolver(
      {
        permifyRole: {
          findUniqueOrThrow: vi.fn(),
          findUnique: vi.fn(),
          findMany: vi.fn().mockResolvedValue([]),
        },
        permifyPermission,
        permifyModelHasRole: {
          upsert: vi.fn(),
          deleteMany: vi.fn(),
          createMany: vi.fn(),
        },
        permifyModelHasPermission: permifyModelHasPermissionWriter,
        permifyRoleHasPermission: {
          upsert: vi.fn(),
          deleteMany: vi.fn(),
          createMany: vi.fn(),
        },
      } as any,
      { scopeMode: 'tenant' }
    );

    await resolver.getDirectPermissions({ id: 'user-1' }, { tenantId: 'acme' });
    expect(permifyModelHasPermission.findMany).toHaveBeenCalledWith({
      where: {
        modelId: 'user-1',
        modelType: 'User',
        tenantId: 'acme',
      },
      include: { permission: true },
    });

    await writeResolver.givePermissionTo({ id: 'user-1' }, 'post.publish', {
      tenantId: 'acme',
    });
    expect(permifyModelHasPermissionWriter.upsert).toHaveBeenCalledWith({
      where: {
        modelId_modelType_tenantId_permissionId: {
          modelId: 'user-1',
          modelType: 'User',
          tenantId: 'acme',
          permissionId: 'permission-1',
        },
      },
      create: {
        modelId: 'user-1',
        modelType: 'User',
        tenantId: 'acme',
        permissionId: 'permission-1',
      },
      update: {},
    });
  });

  it('uses only team scope in team mode', async () => {
    const permifyRole = {
      findUnique: vi.fn().mockResolvedValue({ id: 'role-1' }),
    };
    const permifyRoleHasPermission = {
      findMany: vi.fn().mockResolvedValue([{ permission: { name: 'post.publish' } }]),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    };
    const permifyPermission = {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'permission-1' }),
      findUnique: vi.fn().mockResolvedValue({ id: 'permission-1' }),
      findMany: vi.fn().mockResolvedValue([]),
    };

    const resolver = createPrismaResolver(
      {
        permifyModelHasRole: { findMany: vi.fn().mockResolvedValue([]) },
        permifyModelHasPermission: { findMany: vi.fn().mockResolvedValue([]) },
        permifyRole,
        permifyRoleHasPermission,
      } as any,
      { scopeMode: 'team' }
    );
    const writeResolver = createPrismaWriteResolver(
      {
        permifyRole: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'role-1' }),
          findUnique: vi.fn().mockResolvedValue({ id: 'role-1' }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        permifyPermission,
        permifyModelHasRole: {
          upsert: vi.fn(),
          deleteMany: vi.fn(),
          createMany: vi.fn(),
        },
        permifyModelHasPermission: {
          upsert: vi.fn(),
          deleteMany: vi.fn(),
          createMany: vi.fn(),
        },
        permifyRoleHasPermission,
      } as any,
      { scopeMode: 'team' }
    );

    expect(await resolver.getRolePermissions('admin', { teamId: 'design' })).toEqual([
      'post.publish',
    ]);
    expect(permifyRoleHasPermission.findMany).toHaveBeenCalledWith({
      where: {
        roleId: 'role-1',
        teamId: 'design',
      },
      include: { permission: true },
    });

    await writeResolver.assignPermissionToRole('admin', 'post.publish', {
      teamId: 'design',
    });
    expect(permifyRoleHasPermission.upsert).toHaveBeenCalledWith({
      where: {
        roleId_permissionId_teamId: {
          roleId: 'role-1',
          permissionId: 'permission-1',
          teamId: 'design',
        },
      },
      create: {
        roleId: 'role-1',
        permissionId: 'permission-1',
        teamId: 'design',
      },
      update: {},
    });
  });

  it('preserves tenant-team behavior when scopeMode is omitted', async () => {
    const permifyModelHasRole = {
      findMany: vi.fn().mockResolvedValue([{ role: { name: 'admin' } }]),
    };

    const resolver = createPrismaResolver(
      {
        permifyModelHasRole,
        permifyModelHasPermission: { findMany: vi.fn().mockResolvedValue([]) },
        permifyRole: { findUnique: vi.fn().mockResolvedValue(null) },
        permifyRoleHasPermission: { findMany: vi.fn().mockResolvedValue([]) },
      } as any
    );

    await resolver.getRoles({ id: 'user-1' });
    expect(permifyModelHasRole.findMany).toHaveBeenCalledWith({
      where: {
        modelId: 'user-1',
        modelType: 'User',
        tenantId: GLOBAL_SCOPE,
        teamId: GLOBAL_SCOPE,
      },
      include: { role: true },
    });
  });
});

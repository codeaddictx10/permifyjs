import { afterEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { registerPermifyModels } from '../models';
import { createMongooseResolver } from '../resolver';
import { createMongooseWriteResolver } from '../writeResolver';

const GLOBAL_SCOPE = '__permify_global__';

const connections: mongoose.Connection[] = [];

function createTestConnection(): mongoose.Connection {
  const connection = mongoose.createConnection();
  connections.push(connection);
  return connection;
}

function chain<T>(value: T) {
  return {
    lean: vi.fn().mockResolvedValue(value),
    select: vi.fn().mockReturnThis(),
  };
}

afterEach(async () => {
  while (connections.length > 0) {
    const connection = connections.pop();
    if (connection) {
      await connection.destroy();
    }
  }
});

describe('@permifyjs/mongoose scope modes', () => {
  it('registers global-only schemas without tenant or team fields', () => {
    const connection = createTestConnection();
    const models = registerPermifyModels({ connection, scopeMode: 'global' });

    expect(models.ModelHasRole.schema.path('tenantId')).toBeUndefined();
    expect(models.ModelHasRole.schema.path('teamId')).toBeUndefined();
    expect(models.ModelHasRole.schema.indexes()).toContainEqual([
      { modelId: 1, modelType: 1, roleId: 1 },
      { unique: true, background: true },
    ]);
  });

  it('registers tenant-only schemas with tenant indexes only', () => {
    const connection = createTestConnection();
    const models = registerPermifyModels({ connection, scopeMode: 'tenant' });

    expect(models.ModelHasRole.schema.path('tenantId')?.defaultValue).toBe(GLOBAL_SCOPE);
    expect(models.ModelHasRole.schema.path('teamId')).toBeUndefined();
    expect(models.ModelHasRole.schema.indexes()).toContainEqual([
      { modelId: 1, modelType: 1, tenantId: 1, roleId: 1 },
      { unique: true, background: true },
    ]);
  });

  it('registers team-only schemas with team indexes only', () => {
    const connection = createTestConnection();
    const models = registerPermifyModels({ connection, scopeMode: 'team' });

    expect(models.ModelHasPermission.schema.path('tenantId')).toBeUndefined();
    expect(models.ModelHasPermission.schema.path('teamId')?.defaultValue).toBe(
      GLOBAL_SCOPE
    );
    expect(models.ModelHasPermission.schema.indexes()).toContainEqual([
      { modelId: 1, modelType: 1, teamId: 1, permissionId: 1 },
      { unique: true, background: true },
    ]);
  });

  it('throws if the same registry is reused with a different scope mode', () => {
    const connection = createTestConnection();
    registerPermifyModels({ connection, scopeMode: 'global' });

    expect(() =>
      registerPermifyModels({ connection, scopeMode: 'tenant-team' })
    ).toThrow(/already initialized/);
  });

  it('uses only the configured scope fields in resolver reads and writes', async () => {
    const connection = createTestConnection();
    const models = registerPermifyModels({ connection, scopeMode: 'team' });

    const modelHasRoleFind = vi.fn().mockReturnValue(chain([{ roleId: 'role-1' }]));
    const roleHasPermissionFind = vi.fn().mockReturnValueOnce(
      chain([{ permissionId: 'permission-1' }])
    );
    const roleFind = vi.fn().mockReturnValue(chain([{ name: 'admin' }]));
    const roleFindOne = vi.fn().mockReturnValue(chain({ _id: 'role-1' }));
    const permissionFind = vi.fn().mockReturnValue(chain([{ name: 'post.publish' }]));
    const permissionFindOne = vi.fn().mockReturnValue(chain({ _id: 'permission-1' }));

    (models.ModelHasRole as any).find = modelHasRoleFind;
    (models.ModelHasRole as any).updateOne = vi.fn();
    (models.ModelHasPermission as any).find = vi.fn().mockReturnValue(chain([]));
    (models.ModelHasPermission as any).updateOne = vi.fn();
    (models.RoleHasPermission as any).find = roleHasPermissionFind;
    (models.RoleHasPermission as any).updateOne = vi.fn();
    (models.Role as any).find = roleFind;
    (models.Role as any).findOne = roleFindOne;
    (models.Permission as any).find = permissionFind;
    (models.Permission as any).findOne = permissionFindOne;

    const resolver = createMongooseResolver({ connection, scopeMode: 'team' });
    const writeResolver = createMongooseWriteResolver({
      connection,
      scopeMode: 'team',
    });

    expect(await resolver.getRoles({ id: 'user-1' }, { teamId: 'design' })).toEqual([
      'admin',
    ]);
    expect(modelHasRoleFind).toHaveBeenCalledWith({
      modelId: 'user-1',
      modelType: 'User',
      teamId: 'design',
    });

    expect(
      await resolver.getPermissionsThroughRoles({ id: 'user-1' }, { teamId: 'design' })
    ).toEqual(['post.publish']);
    expect(roleHasPermissionFind).toHaveBeenCalledWith({
      roleId: { $in: ['role-1'] },
      teamId: 'design',
    });

    await writeResolver.assignRole({ id: 'user-1' }, 'admin', { teamId: 'design' });
    expect((models.ModelHasRole as any).updateOne).toHaveBeenCalledWith(
      {
        modelId: 'user-1',
        modelType: 'User',
        teamId: 'design',
        roleId: 'role-1',
      },
      {
        $setOnInsert: {
          modelId: 'user-1',
          modelType: 'User',
          teamId: 'design',
          roleId: 'role-1',
        },
      },
      { upsert: true }
    );
  });

  it('preserves tenant-team behavior when scopeMode is omitted', async () => {
    const connection = createTestConnection();
    const models = registerPermifyModels({ connection });

    expect(models.ModelHasRole.schema.path('tenantId')?.defaultValue).toBe(GLOBAL_SCOPE);
    expect(models.ModelHasRole.schema.path('teamId')?.defaultValue).toBe(GLOBAL_SCOPE);
  });
});

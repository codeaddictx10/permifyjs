import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  GLOBAL_SCOPE,
  createPermifyRecord,
  createTypeOrmResolver,
  createTypeOrmWriteResolver,
  dropPermifySchema,
  getPermifySchemaStatus,
  syncPermifySchema,
} from '../index';

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'permifyjs-typeorm-'));
  tempDirs.push(dir);
  return dir;
}

async function createDataSource(databasePath: string): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: databasePath,
  });

  await dataSource.initialize();
  return dataSource;
}

afterAll(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('@permifyjs/typeorm integration', () => {
  it('syncs, reads, and writes roles and permissions against a real sqlite database', async () => {
    const tempDir = createTempDir();
    const dataSource = await createDataSource(join(tempDir, 'test.db'));

    try {
      expect(await getPermifySchemaStatus(dataSource)).toEqual({
        allPresent: false,
        tables: {
          roles: false,
          permissions: false,
          roleHasPermissions: false,
          modelHasRoles: false,
          modelHasPermissions: false,
        },
      });

      await syncPermifySchema(dataSource);
      expect(await getPermifySchemaStatus(dataSource)).toEqual({
        allPresent: true,
        tables: {
          roles: true,
          permissions: true,
          roleHasPermissions: true,
          modelHasRoles: true,
          modelHasPermissions: true,
        },
      });

      const resolver = createTypeOrmResolver(dataSource);
      const writeResolver = createTypeOrmWriteResolver(dataSource);
      const scopedContext = { tenantId: 'acme', teamId: 'design' };

      expect(await createPermifyRecord(dataSource, 'roles', 'admin')).toBe('created');
      expect(await createPermifyRecord(dataSource, 'roles', 'editor')).toBe('created');
      await dataSource
        .createQueryBuilder()
        .insert()
        .into('roles')
        .values({
          id: randomUUID(),
          name: 'editor',
          tenantId: scopedContext.tenantId,
          teamId: scopedContext.teamId,
        })
        .execute();
      expect(await createPermifyRecord(dataSource, 'permissions', 'post.create')).toBe(
        'created'
      );
      expect(await createPermifyRecord(dataSource, 'permissions', 'post.edit')).toBe(
        'created'
      );
      expect(
        await createPermifyRecord(dataSource, 'permissions', 'post.publish')
      ).toBe('created');
      expect(
        await createPermifyRecord(dataSource, 'permissions', 'post.archive')
      ).toBe('created');
      expect(await createPermifyRecord(dataSource, 'permissions', 'team.manage')).toBe(
        'created'
      );
      expect(await createPermifyRecord(dataSource, 'roles', 'admin')).toBe('exists');

      await writeResolver.assignPermissionToRole('admin', 'post.create');
      await writeResolver.assignPermissionToRole('admin', 'post.edit');
      await writeResolver.assignPermissionToRole('editor', 'post.publish');

      await writeResolver.assignRole({ id: 'user-1' }, 'admin');
      await writeResolver.assignRole({ id: 'user-1' }, 'admin');
      await writeResolver.givePermissionTo({ id: 'user-1' }, 'post.publish');
      await writeResolver.givePermissionTo({ id: 'user-1' }, 'post.publish');
      await writeResolver.assignRole({ id: 'team-1', modelType: 'Team' }, 'editor');
      await writeResolver.givePermissionTo(
        { id: 'team-1', modelType: 'Team' },
        'team.manage'
      );
      await writeResolver.assignRole({ id: 'user-1' }, 'editor', scopedContext);
      await writeResolver.givePermissionTo(
        { id: 'user-1' },
        'team.manage',
        scopedContext
      );
      await writeResolver.assignPermissionToRole(
        'editor',
        'post.archive',
        scopedContext
      );
      await writeResolver.assignPermissionToRole(
        'editor',
        'post.archive',
        scopedContext
      );

      expect(await resolver.getRoles({ id: 'user-1' })).toEqual(['admin']);
      expect(await resolver.getRoles({ id: 'user-1' }, scopedContext)).toEqual([
        'editor',
      ]);
      expect(await resolver.getDirectPermissions({ id: 'user-1' })).toEqual([
        'post.publish',
      ]);
      expect(
        await resolver.getDirectPermissions({ id: 'user-1' }, scopedContext)
      ).toEqual(['team.manage']);
      expect(await resolver.getPermissionsThroughRoles({ id: 'user-1' })).toEqual(
        expect.arrayContaining(['post.create', 'post.edit'])
      );
      expect(
        await resolver.getPermissionsThroughRoles({ id: 'user-1' }, scopedContext)
      ).toEqual(['post.archive']);
      expect(await resolver.getRolePermissions('admin')).toEqual(
        expect.arrayContaining(['post.create', 'post.edit'])
      );
      expect(await resolver.getRolePermissions('editor')).toEqual(['post.publish']);
      expect(await resolver.getRolePermissions('editor', scopedContext)).toEqual([
        'post.archive',
      ]);
      expect(await resolver.getRoles({ id: 'team-1', modelType: 'Team' })).toEqual([
        'editor',
      ]);
      expect(
        await resolver.getDirectPermissions({ id: 'team-1', modelType: 'Team' })
      ).toEqual(['team.manage']);
      expect(await resolver.getRoles({ id: 'team-1' })).toEqual([]);

      await writeResolver.syncRoles({ id: 'user-1' }, ['editor']);
      await writeResolver.syncPermissions({ id: 'user-1' }, ['post.create']);
      await writeResolver.assignPermissionToRole('editor', 'post.archive');

      expect(await resolver.getRoles({ id: 'user-1' })).toEqual(['editor']);
      expect(await resolver.getRoles({ id: 'user-1' }, scopedContext)).toEqual([
        'editor',
      ]);
      expect(await resolver.getDirectPermissions({ id: 'user-1' })).toEqual([
        'post.create',
      ]);
      expect(
        await resolver.getDirectPermissions({ id: 'user-1' }, scopedContext)
      ).toEqual(['team.manage']);
      expect(await resolver.getPermissionsThroughRoles({ id: 'user-1' })).toEqual(
        expect.arrayContaining(['post.archive', 'post.publish'])
      );
      expect(
        await resolver.getPermissionsThroughRoles({ id: 'user-1' }, scopedContext)
      ).toEqual(['post.archive']);

      await writeResolver.removeRole({ id: 'user-1' }, 'editor');
      await writeResolver.revokePermissionTo({ id: 'user-1' }, 'post.create');
      expect(await resolver.getRoles({ id: 'user-1' })).toEqual([]);
      expect(await resolver.getDirectPermissions({ id: 'user-1' })).toEqual([]);
      expect(await resolver.getRoles({ id: 'user-1' }, scopedContext)).toEqual([
        'editor',
      ]);
      expect(
        await resolver.getDirectPermissions({ id: 'user-1' }, scopedContext)
      ).toEqual(['team.manage']);

      await writeResolver.assignRole({ id: 'user-1' }, 'admin');
      await writeResolver.givePermissionTo({ id: 'user-1' }, 'post.publish');
      await writeResolver.revokePermissionFromRole('admin', 'post.edit');
      expect(await resolver.getRolePermissions('admin')).toEqual(['post.create']);

      await writeResolver.syncRolePermissions('admin', ['post.archive', 'post.edit']);
      expect(await resolver.getRolePermissions('admin')).toEqual(
        expect.arrayContaining(['post.archive', 'post.edit'])
      );
      expect(await resolver.getPermissionsThroughRoles({ id: 'user-1' })).toEqual(
        expect.arrayContaining(['post.archive', 'post.edit'])
      );

      const duplicateGlobalRoleCount = await dataSource
        .createQueryBuilder()
        .select('COUNT(*)', 'count')
        .from('model_has_roles', 'assignment')
        .where('assignment.modelId = :modelId', { modelId: 'user-1' })
        .andWhere('assignment.modelType = :modelType', { modelType: 'User' })
        .andWhere('assignment.tenantId = :tenantId', { tenantId: GLOBAL_SCOPE })
        .andWhere('assignment.teamId = :teamId', { teamId: GLOBAL_SCOPE })
        .getRawOne<{ count: number | string }>();
      expect(Number(duplicateGlobalRoleCount?.count ?? 0)).toBe(1);

      await dropPermifySchema(dataSource);
      expect(await getPermifySchemaStatus(dataSource)).toEqual({
        allPresent: false,
        tables: {
          roles: false,
          permissions: false,
          roleHasPermissions: false,
          modelHasRoles: false,
          modelHasPermissions: false,
        },
      });
    } finally {
      await dataSource.destroy();
    }
  });
});

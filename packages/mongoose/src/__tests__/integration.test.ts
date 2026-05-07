import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { registerPermifyModels } from '../models';
import { createMongooseResolver } from '../resolver';
import { createMongooseWriteResolver } from '../writeResolver';

const GLOBAL_SCOPE = '__permify_global__';

// Opt-in because mongodb-memory-server needs to bind a local port, which is blocked in some sandboxed runs.
const runMongoIntegration = process.env.PERMIFYJS_RUN_MONGOOSE_INTEGRATION === '1';

describe('@permifyjs/mongoose integration', () => {
  let mongoServer: MongoMemoryServer;
  let connection: mongoose.Connection;
  let models: ReturnType<typeof registerPermifyModels>;

  beforeAll(async () => {
    if (!runMongoIntegration) return;

    mongoServer = await MongoMemoryServer.create({
      instance: {
        ip: '127.0.0.1',
        port: 27091,
      },
    });
    connection = await mongoose.createConnection(mongoServer.getUri()).asPromise();
    models = registerPermifyModels({ connection });
  }, 60000);

  afterEach(async () => {
    if (!runMongoIntegration || !connection) return;

    for (const collection of Object.values(connection.collections)) {
      await collection.deleteMany({});
    }
  });

  afterAll(async () => {
    if (!runMongoIntegration) return;

    if (connection) {
      await connection.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it.skipIf(!runMongoIntegration)(
    'reads and writes roles and permissions against a real mongodb instance',
    async () => {
      const scopedContext = { tenantId: 'acme', teamId: 'design' };
      const [
        adminRole,
        editorRole,
        createPermission,
        editPermission,
        publishPermission,
        archivePermission,
        managePermission,
      ] = await Promise.all([
          models.Role.create({ name: 'admin' }),
          models.Role.create({ name: 'editor' }),
          models.Permission.create({ name: 'post.create' }),
          models.Permission.create({ name: 'post.edit' }),
          models.Permission.create({ name: 'post.publish' }),
          models.Permission.create({ name: 'post.archive' }),
          models.Permission.create({ name: 'team.manage' }),
        ]);

      await models.RoleHasPermission.create([
        { roleId: adminRole._id, permissionId: createPermission._id },
        { roleId: adminRole._id, permissionId: editPermission._id },
        { roleId: editorRole._id, permissionId: publishPermission._id },
      ]);

      const resolver = createMongooseResolver({ connection });
      const writeResolver = createMongooseWriteResolver({ connection });

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
      await writeResolver.givePermissionTo({ id: 'user-1' }, 'team.manage', scopedContext);
      await writeResolver.assignPermissionToRole('editor', 'post.archive', scopedContext);
      await writeResolver.assignPermissionToRole('editor', 'post.archive', scopedContext);

      expect(await resolver.getRoles({ id: 'user-1' })).toEqual(['admin']);
      expect(await resolver.getRoles({ id: 'user-1' }, scopedContext)).toEqual([
        'editor',
      ]);
      expect(await resolver.getDirectPermissions({ id: 'user-1' })).toEqual([
        'post.publish',
      ]);
      expect(await resolver.getDirectPermissions({ id: 'user-1' }, scopedContext)).toEqual([
        'team.manage',
      ]);
      expect(await resolver.getPermissionsThroughRoles({ id: 'user-1' })).toEqual(
        expect.arrayContaining(['post.create', 'post.edit'])
      );
      expect(await resolver.getPermissionsThroughRoles({ id: 'user-1' }, scopedContext)).toEqual([
        'post.archive',
      ]);
      expect(
        await models.ModelHasRole.countDocuments({
          modelId: 'user-1',
          modelType: 'User',
          tenantId: GLOBAL_SCOPE,
          teamId: GLOBAL_SCOPE,
        })
      ).toBe(1);
      expect(
        await models.ModelHasPermission.countDocuments({
          modelId: 'user-1',
          modelType: 'User',
          tenantId: GLOBAL_SCOPE,
          teamId: GLOBAL_SCOPE,
        })
      ).toBe(1);
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
      await writeResolver.assignPermissionToRole('editor', 'post.archive');

      expect(await resolver.getRoles({ id: 'user-1' })).toEqual(['editor']);
      expect(await resolver.getRoles({ id: 'user-1' }, scopedContext)).toEqual([
        'editor',
      ]);
      expect(await resolver.getDirectPermissions({ id: 'user-1' })).toEqual([
        'post.create',
      ]);
      expect(await resolver.getDirectPermissions({ id: 'user-1' }, scopedContext)).toEqual([
        'team.manage',
      ]);
      expect(await resolver.getPermissionsThroughRoles({ id: 'user-1' })).toEqual(
        expect.arrayContaining(['post.publish', 'post.archive'])
      );
      expect(await resolver.getPermissionsThroughRoles({ id: 'user-1' }, scopedContext)).toEqual([
        'post.archive',
      ]);
      expect(await resolver.getRolePermissions('editor')).toEqual(
        expect.arrayContaining(['post.publish', 'post.archive'])
      );
      expect(await resolver.getRolePermissions('editor', scopedContext)).toEqual([
        'post.archive',
      ]);

      await writeResolver.removeRole({ id: 'user-1' }, 'editor');
      await writeResolver.revokePermissionTo({ id: 'user-1' }, 'post.create');
      expect(await resolver.getRoles({ id: 'user-1' })).toEqual([]);
      expect(await resolver.getDirectPermissions({ id: 'user-1' })).toEqual([]);
      expect(await resolver.getRoles({ id: 'user-1' }, scopedContext)).toEqual([
        'editor',
      ]);
      expect(await resolver.getDirectPermissions({ id: 'user-1' }, scopedContext)).toEqual([
        'team.manage',
      ]);

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
      expect(
        await resolver.getPermissionsThroughRoles({ id: 'team-1', modelType: 'Team' })
      ).toEqual(['post.publish', 'post.archive']);
      expect(publishPermission.name).toBe('post.publish');
      expect(archivePermission.name).toBe('post.archive');
      expect(managePermission.name).toBe('team.manage');
    },
    60000
  );
});

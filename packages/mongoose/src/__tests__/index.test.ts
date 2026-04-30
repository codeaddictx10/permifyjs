import { afterEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import {
  createMongooseResolver,
  createMongooseWriteResolver,
  registerPermifyModels,
} from '../index';

const connections: mongoose.Connection[] = [];

function createTestConnection(): mongoose.Connection {
  const connection = mongoose.createConnection();
  connections.push(connection);
  return connection;
}

afterEach(async () => {
  while (connections.length > 0) {
    const connection = connections.pop();
    if (connection) {
      await connection.destroy();
    }
  }
});

describe('@permifyjs/mongoose', () => {
  it('registers the permify models on a mongoose connection', () => {
    const connection = createTestConnection();
    const models = registerPermifyModels({ connection });

    expect(models.Role.modelName).toBe('PermifyRole');
    expect(models.Permission.modelName).toBe('PermifyPermission');
    expect(models.RoleHasPermission.modelName).toBe('PermifyRoleHasPermission');
    expect(models.ModelHasRole.modelName).toBe('PermifyModelHasRole');
    expect(models.ModelHasPermission.modelName).toBe('PermifyModelHasPermission');
  });

  it('reuses already-registered models', () => {
    const connection = createTestConnection();
    const first = registerPermifyModels({ connection });
    const second = registerPermifyModels({ connection });

    expect(first.Role).toBe(second.Role);
    expect(first.Permission).toBe(second.Permission);
    expect(first.RoleHasPermission).toBe(second.RoleHasPermission);
    expect(first.ModelHasRole).toBe(second.ModelHasRole);
    expect(first.ModelHasPermission).toBe(second.ModelHasPermission);
  });

  it('creates resolver helpers against a provided connection', () => {
    const connection = createTestConnection();
    const resolver = createMongooseResolver({ connection });
    const writeResolver = createMongooseWriteResolver({ connection });

    expect(typeof resolver.getRoles).toBe('function');
    expect(typeof resolver.getDirectPermissions).toBe('function');
    expect(typeof resolver.getPermissionsThroughRoles).toBe('function');
    expect(typeof resolver.getRolePermissions).toBe('function');

    expect(typeof writeResolver.assignRole).toBe('function');
    expect(typeof writeResolver.removeRole).toBe('function');
    expect(typeof writeResolver.syncRoles).toBe('function');
    expect(typeof writeResolver.givePermissionTo).toBe('function');
    expect(typeof writeResolver.revokePermissionTo).toBe('function');
    expect(typeof writeResolver.syncPermissions).toBe('function');
    expect(typeof writeResolver.assignPermissionToRole).toBe('function');
    expect(typeof writeResolver.revokePermissionFromRole).toBe('function');
    expect(typeof writeResolver.syncRolePermissions).toBe('function');
  });
});

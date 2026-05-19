import { describe, expect, it } from 'vitest';
import {
  createTypeOrmResolver,
  createTypeOrmWriteResolver,
  getPermifyTableNames,
} from '../index';

describe('@permifyjs/typeorm', () => {
  it('creates resolver helpers from a typeorm data source-like object', () => {
    const dataSource = {
      createQueryBuilder() {
        return {};
      },
    } as any;

    const resolver = createTypeOrmResolver(dataSource);
    const writeResolver = createTypeOrmWriteResolver(dataSource);

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

  it('resolves default permify table names', () => {
    expect(getPermifyTableNames()).toEqual({
      roles: 'roles',
      permissions: 'permissions',
      roleHasPermissions: 'role_has_permissions',
      modelHasRoles: 'model_has_roles',
      modelHasPermissions: 'model_has_permissions',
    });
  });
});

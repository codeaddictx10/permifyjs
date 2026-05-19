import { describe, expect, it } from 'vitest';
import { getEnabledScopeFields, normalizeScope } from '../scope';
import { getPermifyTableNames } from '../schema';

describe('@permifyjs/typeorm scope helpers', () => {
  it('preserves the default tenant-team scope behavior', () => {
    expect(getEnabledScopeFields()).toEqual(['tenantId', 'teamId']);
    expect(normalizeScope(undefined, undefined)).toEqual({
      tenantId: '__permify_global__',
      teamId: '__permify_global__',
    });
  });

  it('omits scope fields in global mode', () => {
    expect(getEnabledScopeFields('global')).toEqual([]);
    expect(normalizeScope('global', { tenantId: 'acme', teamId: 'design' })).toEqual(
      {}
    );
  });

  it('allows overriding table names', () => {
    expect(
      getPermifyTableNames({
        roles: 'custom_roles',
        modelHasPermissions: 'custom_model_has_permissions',
      })
    ).toEqual({
      roles: 'custom_roles',
      permissions: 'permissions',
      roleHasPermissions: 'role_has_permissions',
      modelHasRoles: 'model_has_roles',
      modelHasPermissions: 'custom_model_has_permissions',
    });
  });
});

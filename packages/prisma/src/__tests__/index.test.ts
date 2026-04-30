import { describe, expect, it } from 'vitest';
import { createPrismaResolver, createPrismaWriteResolver } from '../index';

describe('@permifyjs/prisma', () => {
  it('creates resolver helpers from a prisma client-like object', () => {
    const prisma = {} as any;

    const resolver = createPrismaResolver(prisma);
    const writeResolver = createPrismaWriteResolver(prisma);

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

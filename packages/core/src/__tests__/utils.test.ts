import { describe, expect, it, vi } from 'vitest';
import {
  getAllPermissions,
  getDirectPermissions,
  getPermissionsThroughRoles,
  getRolePermissions,
  getRoles,
} from '../utils';

describe('public read helpers', () => {
  const user = { id: '1', modelType: 'User' };
  const context = { tenantId: 'acme' };

  it('delegates to the auth engine read methods', async () => {
    const auth = {
      getRoles: vi.fn(async () => ['admin']),
      getDirectPermissions: vi.fn(async () => ['post.publish']),
      getPermissionsThroughRoles: vi.fn(async () => ['post.create']),
      getAllPermissions: vi.fn(async () => ['post.publish', 'post.create']),
      getRolePermissions: vi.fn(async () => ['post.create']),
    } as any;

    await expect(getRoles(auth, user, context)).resolves.toEqual(['admin']);
    await expect(getDirectPermissions(auth, user, context)).resolves.toEqual([
      'post.publish',
    ]);
    await expect(getPermissionsThroughRoles(auth, user, context)).resolves.toEqual([
      'post.create',
    ]);
    await expect(getAllPermissions(auth, user, context)).resolves.toEqual([
      'post.publish',
      'post.create',
    ]);
    await expect(getRolePermissions(auth, 'admin', context)).resolves.toEqual([
      'post.create',
    ]);

    expect(auth.getRoles).toHaveBeenCalledWith(user, context);
    expect(auth.getDirectPermissions).toHaveBeenCalledWith(user, context);
    expect(auth.getPermissionsThroughRoles).toHaveBeenCalledWith(user, context);
    expect(auth.getAllPermissions).toHaveBeenCalledWith(user, context);
    expect(auth.getRolePermissions).toHaveBeenCalledWith('admin', context);
  });
});

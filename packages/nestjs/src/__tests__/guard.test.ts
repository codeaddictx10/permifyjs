import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createAuth } from '@permifyjs/core';
import { PermifyGuard } from '../auth.guard';
import { PERMISSIONS_KEY, ROLES_KEY } from '../permissions.decorator';

const resolver = {
  getRoles: async (user: any) => {
    const map: Record<string, string[]> = {
      '1': ['admin'],
      '2': ['editor'],
      '3': [],
    };
    return map[user.id] ?? [];
  },
  getDirectPermissions: async (user: any) => {
    const map: Record<string, string[]> = {
      '1': ['post.publish'],
      '2': [],
      '3': [],
    };
    return map[user.id] ?? [];
  },
  getPermissionsThroughRoles: async (user: any) => {
    const map: Record<string, string[]> = {
      '1': ['post.create', 'post.edit', 'post.delete'],
      '2': ['post.create', 'post.edit'],
      '3': [],
    };
    return map[user.id] ?? [];
  },
  getRolePermissions: async (role: string) => {
    const map: Record<string, string[]> = {
      admin: ['post.create', 'post.edit', 'post.delete'],
      editor: ['post.create', 'post.edit'],
    };
    return map[role] ?? [];
  },
};

const auth = createAuth({ resolver });

function createMockContext(userId: string): ExecutionContext {
  const req = { user: { id: userId } };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function createGuard(permissions: string[] = [], roles: string[] = []) {
  const reflector = {
    getAllAndOverride: vi.fn((key: string) => {
      if (key === PERMISSIONS_KEY) return permissions;
      if (key === ROLES_KEY) return roles;
      return [];
    }),
  } as unknown as Reflector;

  return new PermifyGuard(reflector, auth, {
    getUser: (req) => req.user,
  });
}

describe('PermifyGuard — permissions', () => {
  it('allows user with role permission', async () => {
    const guard = createGuard(['post.create']);
    expect(await guard.canActivate(createMockContext('2'))).toBe(true);
  });

  it('allows user with direct permission', async () => {
    const guard = createGuard(['post.publish']);
    expect(await guard.canActivate(createMockContext('1'))).toBe(true);
  });

  it('throws ForbiddenException for missing permission', async () => {
    const guard = createGuard(['post.delete']);
    await expect(
      guard.canActivate(createMockContext('2'))
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException for user with no permissions', async () => {
    const guard = createGuard(['post.create']);
    await expect(
      guard.canActivate(createMockContext('3'))
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('PermifyGuard — roles', () => {
  it('allows user with valid role', async () => {
    const guard = createGuard([], ['admin']);
    expect(await guard.canActivate(createMockContext('1'))).toBe(true);
  });

  it('throws ForbiddenException for wrong role', async () => {
    const guard = createGuard([], ['admin']);
    await expect(
      guard.canActivate(createMockContext('2'))
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('PermifyGuard — no decorators', () => {
  it('allows through when no permissions or roles set', async () => {
    const guard = createGuard([], []);
    expect(await guard.canActivate(createMockContext('3'))).toBe(true);
  });
});

describe('PermifyGuard — beforeCheck hook', () => {
  it('super admin bypasses all checks', async () => {
    const superAuth = createAuth({
      resolver,
      beforeCheck: ({ model }) =>
        (model as any).isSuperAdmin ? true : null,
    });

    const reflector = {
      getAllAndOverride: vi.fn((key: string) => {
        if (key === PERMISSIONS_KEY) return ['post.delete'];
        return [];
      }),
    } as unknown as Reflector;

    const guard = new PermifyGuard(reflector, superAuth, {
      getUser: (req) => req.user,
    });

    const req = { user: { id: '3', isSuperAdmin: true } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    expect(await guard.canActivate(ctx)).toBe(true);
  });
});

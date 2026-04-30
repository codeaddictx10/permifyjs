import { describe, it, expect, vi } from 'vitest';
import { createAuth } from '@permifyjs/core';
import { createExpressAdapter } from '../middleware';
import type { Request, Response, NextFunction } from 'express';

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

const adapter = createExpressAdapter(auth, {
  getUser: (req) => ({ id: req.headers['x-user-id'] as string }),
});

function mockReq(userId: string): Partial<Request> {
  return { headers: { 'x-user-id': userId } };
}

function mockRes(): Partial<Response> {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe('authorize middleware', () => {
  it('allows user with role permission', async () => {
    const req = mockReq('2');
    const res = mockRes();
    const next = vi.fn();

    await adapter.authorize('post.create')(
      req as Request,
      res as Response,
      next as NextFunction
    );

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows user with direct permission', async () => {
    const req = mockReq('1');
    const res = mockRes();
    const next = vi.fn();

    await adapter.authorize('post.publish')(
      req as Request,
      res as Response,
      next as NextFunction
    );

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 for missing permission', async () => {
    const req = mockReq('3');
    const res = mockRes();
    const next = vi.fn();

    await adapter.authorize('post.create')(
      req as Request,
      res as Response,
      next as NextFunction
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for wrong role', async () => {
    const req = mockReq('2');
    const res = mockRes();
    const next = vi.fn();

    await adapter.authorizeRole('admin')(
      req as Request,
      res as Response,
      next as NextFunction
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows admin role', async () => {
    const req = mockReq('1');
    const res = mockRes();
    const next = vi.fn();

    await adapter.authorizeRole('admin')(
      req as Request,
      res as Response,
      next as NextFunction
    );

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

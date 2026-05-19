import { describe, it, expect, vi } from 'vitest';
import { createAuth } from '@permifyjs/core';
import { createFastifyAdapter } from '../middleware';
import type { FastifyReply, FastifyRequest } from 'fastify';

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
const adapter = createFastifyAdapter(auth, {
  getUser: (request) => ({
    id: request.headers['x-user-id'] as string,
  }),
});

function mockRequest(userId: string): Partial<FastifyRequest> {
  return {
    headers: {
      'x-user-id': userId,
    },
  };
}

function mockReply(): Partial<FastifyReply> {
  const reply: Partial<FastifyReply> = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockResolvedValue(undefined),
  };
  return reply;
}

describe('fastify authorize adapter', () => {
  it('allows user with role permission', async () => {
    const request = mockRequest('2');
    const reply = mockReply();

    await adapter.authorize('post.create')(
      request as FastifyRequest,
      reply as FastifyReply
    );

    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('returns 403 for missing permission', async () => {
    const request = mockRequest('3');
    const reply = mockReply();

    await adapter.authorize('post.create')(
      request as FastifyRequest,
      reply as FastifyReply
    );

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Forbidden' });
  });

  it('allows admin role', async () => {
    const request = mockRequest('1');
    const reply = mockReply();

    await adapter.authorizeRole('admin')(
      request as FastifyRequest,
      reply as FastifyReply
    );

    expect(reply.code).not.toHaveBeenCalled();
  });
});

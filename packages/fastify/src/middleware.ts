import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthEngine } from '@permifyjs/core';
import type { FastifyAdapterOptions } from './types';

export function createFastifyAdapter(
  auth: AuthEngine,
  opts: FastifyAdapterOptions
) {
  return {
    authorize(permission: string) {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = opts.getUser(request);
        const context = opts.getContext?.(request);
        const allowed = await auth.can(user, permission, context);

        if (!allowed) {
          await reply.code(403).send({ error: 'Forbidden' });
        }
      };
    },

    authorizeRole(role: string) {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = opts.getUser(request);
        const context = opts.getContext?.(request);
        const allowed = await auth.hasRole(user, role, context);

        if (!allowed) {
          await reply.code(403).send({ error: 'Forbidden' });
        }
      };
    },
  };
}

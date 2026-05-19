import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthUser, AuthContext, AuthEngine } from '@permifyjs/core';

interface FastifyAdapterOptions {
    getUser: (request: FastifyRequest) => AuthUser;
    getContext?: (request: FastifyRequest) => AuthContext;
}

declare function createFastifyAdapter(auth: AuthEngine, opts: FastifyAdapterOptions): {
    authorize(permission: string): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorizeRole(role: string): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
};

export { type FastifyAdapterOptions, createFastifyAdapter };

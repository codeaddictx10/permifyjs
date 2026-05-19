import type { FastifyRequest } from 'fastify';
import type { AuthContext, AuthUser } from '@permifyjs/core';

export interface FastifyAdapterOptions {
  getUser: (request: FastifyRequest) => AuthUser;
  getContext?: (request: FastifyRequest) => AuthContext;
}

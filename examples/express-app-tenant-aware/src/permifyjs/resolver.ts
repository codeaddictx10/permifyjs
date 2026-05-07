import type { PermissionResolver } from '@permifyjs/core';
import config from '../../permifyjs.config';
import { createPrismaResolver } from '@permifyjs/prisma';
import prisma from '../db';

export const resolver: PermissionResolver = createPrismaResolver(prisma, {
  scopeMode: config.scopeMode,
});

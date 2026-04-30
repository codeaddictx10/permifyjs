import { PermissionResolver, PermissionWriteResolver } from '@permifyjs/core';
import { PrismaClient } from '@prisma/client/extension';

declare function createPrismaResolver(prisma: PrismaClient): PermissionResolver;

declare function createPrismaWriteResolver(prisma: PrismaClient): PermissionWriteResolver;

export { createPrismaResolver, createPrismaWriteResolver };

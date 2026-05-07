import { PermissionResolver, PermissionWriteResolver } from '@permifyjs/core';
import { PrismaClient } from '@prisma/client/extension';

type ScopeMode = 'global' | 'tenant' | 'team' | 'tenant-team';

interface PrismaResolverOptions {
    scopeMode?: ScopeMode;
}
declare function createPrismaResolver(prisma: PrismaClient, options?: PrismaResolverOptions): PermissionResolver;

interface PrismaWriteResolverOptions {
    scopeMode?: ScopeMode;
}
declare function createPrismaWriteResolver(prisma: PrismaClient, options?: PrismaWriteResolverOptions): PermissionWriteResolver;

export { type PrismaResolverOptions, type PrismaWriteResolverOptions, createPrismaResolver, createPrismaWriteResolver };

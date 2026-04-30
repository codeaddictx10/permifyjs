import type {
  PermissionResolver,
  AuthModel,
  AuthContext,
} from '@permifyjs/core';
import { PrismaClient } from '@prisma/client/extension';

export function createPrismaResolver(prisma: PrismaClient): PermissionResolver {
  return {
    getRoles: async (model: AuthModel, _context?: AuthContext) => {
      const results = await (prisma as any).permifyModelHasRole.findMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? 'User',
        },
        include: { role: true },
      });
      return results.map((r: any) => r.role.name);
    },

    getDirectPermissions: async (model: AuthModel, _context?: AuthContext) => {
      const results = await (prisma as any).permifyModelHasPermission.findMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? 'User',
        },
        include: { permission: true },
      });
      return results.map((r: any) => r.permission.name);
    },

    getPermissionsThroughRoles: async (
      model: AuthModel,
      _context?: AuthContext
    ) => {
      const results = await (prisma as any).permifyModelHasRole.findMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? 'User',
        },
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      });

      const permissions = results
        .flatMap((r: any) => r.role.permissions)
        .map((p: any) => p.permission.name);

      return [...new Set<string>(permissions)];
    },

    getRolePermissions: async (role: string, _context?: AuthContext) => {
      const result = await (prisma as any).permifyRole.findUnique({
        where: { name: role },
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      });
      return result?.permissions.map((p: any) => p.permission.name) ?? [];
    },
  };
}

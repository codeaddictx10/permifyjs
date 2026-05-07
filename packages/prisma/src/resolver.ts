import type {
  PermissionResolver,
  AuthModel,
  AuthContext,
} from '@permifyjs/core';
import { PrismaClient } from '@prisma/client/extension';
import { normalizeScope, type ScopeMode } from './scope';

export interface PrismaResolverOptions {
  scopeMode?: ScopeMode;
}

export function createPrismaResolver(
  prisma: PrismaClient,
  options: PrismaResolverOptions = {}
): PermissionResolver {
  return {
    getRoles: async (model: AuthModel, context?: AuthContext) => {
      const scope = normalizeScope(options.scopeMode, context);
      const results = await (prisma as any).permifyModelHasRole.findMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? 'User',
          ...scope,
        },
        include: { role: true },
      });
      return results.map((r: any) => r.role.name);
    },

    getDirectPermissions: async (model: AuthModel, context?: AuthContext) => {
      const scope = normalizeScope(options.scopeMode, context);
      const results = await (prisma as any).permifyModelHasPermission.findMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? 'User',
          ...scope,
        },
        include: { permission: true },
      });
      return results.map((r: any) => r.permission.name);
    },

    getPermissionsThroughRoles: async (
      model: AuthModel,
      context?: AuthContext
    ) => {
      const scope = normalizeScope(options.scopeMode, context);
      const roleAssignments = await (prisma as any).permifyModelHasRole.findMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? 'User',
          ...scope,
        },
      });

      if (roleAssignments.length === 0) return [];

      const rolePermissions = await (prisma as any).permifyRoleHasPermission.findMany({
        where: {
          roleId: { in: roleAssignments.map((assignment: any) => assignment.roleId) },
          ...scope,
        },
        include: { permission: true },
      });

      const permissions = rolePermissions.map((link: any) => link.permission.name);

      return [...new Set<string>(permissions)];
    },

    getRolePermissions: async (role: string, context?: AuthContext) => {
      const scope = normalizeScope(options.scopeMode, context);
      const roleRecord = await (prisma as any).permifyRole.findUnique({
        where: { name: role, ...scope },
      });
      if (!roleRecord) return [];

      const result = await (prisma as any).permifyRoleHasPermission.findMany({
        where: {
          roleId: roleRecord.id,
          ...scope,
        },
        include: { permission: true },
      });

      return result.map((link: any) => link.permission.name);
    },
  };
}

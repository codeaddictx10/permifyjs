import type {
  PermissionWriteResolver,
  AuthModel,
  AuthContext,
} from '@permifyjs/core';
import { PrismaClient } from '@prisma/client/extension';
import {
  getScopedCompoundKeyName,
  normalizeScope,
  type ScopeMode,
} from './scope';

export interface PrismaWriteResolverOptions {
  scopeMode?: ScopeMode;
}

export function createPrismaWriteResolver(
  prisma: PrismaClient,
  options: PrismaWriteResolverOptions = {}
): PermissionWriteResolver {
  return {
    // ─── Model role assignment ──────────────────────────────────────

    assignRole: async (model: AuthModel, role: string, context?: AuthContext) => {
      const scope = normalizeScope(options.scopeMode, context);
      const roleRecord = await (prisma as any).permifyRole.findUniqueOrThrow({
        where: { name: role },
      });

      await (prisma as any).permifyModelHasRole.upsert({
        where: {
          [getScopedCompoundKeyName(
            ['modelId', 'modelType'],
            ['roleId'],
            options.scopeMode
          )]: {
            modelId: model.id,
            modelType: model.modelType ?? 'User',
            ...scope,
            roleId: roleRecord.id,
          },
        },
        create: {
          modelId: model.id,
          modelType: model.modelType ?? 'User',
          ...scope,
          roleId: roleRecord.id,
        },
        update: {},
      });
    },

    removeRole: async (model: AuthModel, role: string, context?: AuthContext) => {
      const scope = normalizeScope(options.scopeMode, context);
      const roleRecord = await (prisma as any).permifyRole.findUnique({
        where: { name: role, ...scope },
      });
      if (!roleRecord) return;

      await (prisma as any).permifyModelHasRole.deleteMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? 'User',
          ...scope,
          roleId: roleRecord.id,
        },
      });
    },

    syncRoles: async (model: AuthModel, roles: string[], context?: AuthContext) => {
      const scope = normalizeScope(options.scopeMode, context);
      const roleRecords = await (prisma as any).permifyRole.findMany({
        where: { name: { in: roles }, ...scope },
      });

      await (prisma as any).permifyModelHasRole.deleteMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? 'User',
          ...scope,
        },
      });

      await (prisma as any).permifyModelHasRole.createMany({
        data: roleRecords.map((r: any) => ({
          modelId: model.id,
          modelType: model.modelType ?? 'User',
          ...scope,
          roleId: r.id,
        })),
      });
    },

    // ─── Model direct permission assignment ─────────────────────────

    givePermissionTo: async (
      model: AuthModel,
      permission: string,
      context?: AuthContext
    ) => {
      const scope = normalizeScope(options.scopeMode, context);
      const permRecord = await (prisma as any).permifyPermission.findUniqueOrThrow({
        where: { name: permission },
      });

      await (prisma as any).permifyModelHasPermission.upsert({
        where: {
          [getScopedCompoundKeyName(
            ['modelId', 'modelType'],
            ['permissionId'],
            options.scopeMode
          )]: {
            modelId: model.id,
            modelType: model.modelType ?? 'User',
            ...scope,
            permissionId: permRecord.id,
          },
        },
        create: {
          modelId: model.id,
          modelType: model.modelType ?? 'User',
          ...scope,
          permissionId: permRecord.id,
        },
        update: {},
      });
    },

    revokePermissionTo: async (
      model: AuthModel,
      permission: string,
      context?: AuthContext
    ) => {
      const scope = normalizeScope(options.scopeMode, context);
      const permRecord = await (prisma as any).permifyPermission.findUnique({
        where: { name: permission },
      });
      if (!permRecord) return;

      await (prisma as any).permifyModelHasPermission.deleteMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? 'User',
          ...scope,
          permissionId: permRecord.id,
        },
      });
    },

    syncPermissions: async (
      model: AuthModel,
      permissions: string[],
      context?: AuthContext
    ) => {
      const scope = normalizeScope(options.scopeMode, context);
      const permRecords = await (prisma as any).permifyPermission.findMany({
        where: { name: { in: permissions } },
      });

      await (prisma as any).permifyModelHasPermission.deleteMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? 'User',
          ...scope,
        },
      });

      await (prisma as any).permifyModelHasPermission.createMany({
        data: permRecords.map((p: any) => ({
          modelId: model.id,
          modelType: model.modelType ?? 'User',
          ...scope,
          permissionId: p.id,
        })),
      });
    },

    // ─── Role permission assignment ─────────────────────────────────

    assignPermissionToRole: async (
      role: string,
      permission: string,
      context?: AuthContext
    ) => {
      const scope = normalizeScope(options.scopeMode, context);
      const [roleRecord, permRecord] = await Promise.all([
        (prisma as any).permifyRole.findUniqueOrThrow({ where: { name: role } }),
        (prisma as any).permifyPermission.findUniqueOrThrow({ where: { name: permission } }),
      ]);

      await (prisma as any).permifyRoleHasPermission.upsert({
        where: {
          [getScopedCompoundKeyName(
            ['roleId', 'permissionId'],
            [],
            options.scopeMode
          )]: {
            roleId: roleRecord.id,
            permissionId: permRecord.id,
            ...scope,
          },
        },
        create: {
          roleId: roleRecord.id,
          permissionId: permRecord.id,
          ...scope,
        },
        update: {},
      });
    },

    revokePermissionFromRole: async (
      role: string,
      permission: string,
      context?: AuthContext
    ) => {
      const scope = normalizeScope(options.scopeMode, context);
      const [roleRecord, permRecord] = await Promise.all([
        (prisma as any).permifyRole.findUnique({ where: { name: role, ...scope } }),
        (prisma as any).permifyPermission.findUnique({ where: { name: permission } }),
      ]);

      if (!roleRecord || !permRecord) return;

      await (prisma as any).permifyRoleHasPermission.deleteMany({
        where: {
          roleId: roleRecord.id,
          permissionId: permRecord.id,
          ...scope,
        },
      });
    },

    syncRolePermissions: async (
      role: string,
      permissions: string[],
      context?: AuthContext
    ) => {
      const scope = normalizeScope(options.scopeMode, context);
      const [roleRecord, permRecords] = await Promise.all([
        (prisma as any).permifyRole.findUniqueOrThrow({ where: { name: role, ...scope } }),
        (prisma as any).permifyPermission.findMany({
          where: { name: { in: permissions } },
        }),
      ]);

      await (prisma as any).permifyRoleHasPermission.deleteMany({
        where: {
          roleId: roleRecord.id,
          ...scope,
        },
      });

      await (prisma as any).permifyRoleHasPermission.createMany({
        data: permRecords.map((p: any) => ({
          roleId: roleRecord.id,
          permissionId: p.id,
          ...scope,
        })),
      });
    },
  };
}

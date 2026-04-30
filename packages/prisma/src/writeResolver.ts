import type {
  PermissionWriteResolver,
  AuthModel,
  AuthContext,
} from '@permifyjs/core';
import { PrismaClient } from '@prisma/client/extension';

export function createPrismaWriteResolver(
  prisma: PrismaClient
): PermissionWriteResolver {
  return {
    // ─── Model role assignment ──────────────────────────────────────

    assignRole: async (model: AuthModel, role: string, _context?: AuthContext) => {
      const roleRecord = await (prisma as any).permifyRole.findUniqueOrThrow({
        where: { name: role },
      });

      await (prisma as any).permifyModelHasRole.upsert({
        where: {
          modelId_modelType_roleId: {
            modelId: model.id,
            modelType: model.modelType ?? 'User',
            roleId: roleRecord.id,
          },
        },
        create: {
          modelId: model.id,
          modelType: model.modelType ?? 'User',
          roleId: roleRecord.id,
        },
        update: {},
      });
    },

    removeRole: async (model: AuthModel, role: string, _context?: AuthContext) => {
      const roleRecord = await (prisma as any).permifyRole.findUnique({
        where: { name: role },
      });
      if (!roleRecord) return;

      await (prisma as any).permifyModelHasRole.deleteMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? 'User',
          roleId: roleRecord.id,
        },
      });
    },

    syncRoles: async (model: AuthModel, roles: string[], _context?: AuthContext) => {
      const roleRecords = await (prisma as any).permifyRole.findMany({
        where: { name: { in: roles } },
      });

      await (prisma as any).permifyModelHasRole.deleteMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? 'User',
        },
      });

      await (prisma as any).permifyModelHasRole.createMany({
        data: roleRecords.map((r: any) => ({
          modelId: model.id,
          modelType: model.modelType ?? 'User',
          roleId: r.id,
        })),
      });
    },

    // ─── Model direct permission assignment ─────────────────────────

    givePermissionTo: async (
      model: AuthModel,
      permission: string,
      _context?: AuthContext
    ) => {
      const permRecord = await (prisma as any).permifyPermission.findUniqueOrThrow({
        where: { name: permission },
      });

      await (prisma as any).permifyModelHasPermission.upsert({
        where: {
          modelId_modelType_permissionId: {
            modelId: model.id,
            modelType: model.modelType ?? 'User',
            permissionId: permRecord.id,
          },
        },
        create: {
          modelId: model.id,
          modelType: model.modelType ?? 'User',
          permissionId: permRecord.id,
        },
        update: {},
      });
    },

    revokePermissionTo: async (
      model: AuthModel,
      permission: string,
      _context?: AuthContext
    ) => {
      const permRecord = await (prisma as any).permifyPermission.findUnique({
        where: { name: permission },
      });
      if (!permRecord) return;

      await (prisma as any).permifyModelHasPermission.deleteMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? 'User',
          permissionId: permRecord.id,
        },
      });
    },

    syncPermissions: async (
      model: AuthModel,
      permissions: string[],
      _context?: AuthContext
    ) => {
      const permRecords = await (prisma as any).permifyPermission.findMany({
        where: { name: { in: permissions } },
      });

      await (prisma as any).permifyModelHasPermission.deleteMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? 'User',
        },
      });

      await (prisma as any).permifyModelHasPermission.createMany({
        data: permRecords.map((p: any) => ({
          modelId: model.id,
          modelType: model.modelType ?? 'User',
          permissionId: p.id,
        })),
      });
    },

    // ─── Role permission assignment ─────────────────────────────────

    assignPermissionToRole: async (
      role: string,
      permission: string,
      _context?: AuthContext
    ) => {
      const [roleRecord, permRecord] = await Promise.all([
        (prisma as any).permifyRole.findUniqueOrThrow({ where: { name: role } }),
        (prisma as any).permifyPermission.findUniqueOrThrow({ where: { name: permission } }),
      ]);

      await (prisma as any).permifyRoleHasPermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roleRecord.id,
            permissionId: permRecord.id,
          },
        },
        create: {
          roleId: roleRecord.id,
          permissionId: permRecord.id,
        },
        update: {},
      });
    },

    revokePermissionFromRole: async (
      role: string,
      permission: string,
      _context?: AuthContext
    ) => {
      const [roleRecord, permRecord] = await Promise.all([
        (prisma as any).permifyRole.findUnique({ where: { name: role } }),
        (prisma as any).permifyPermission.findUnique({ where: { name: permission } }),
      ]);

      if (!roleRecord || !permRecord) return;

      await (prisma as any).permifyRoleHasPermission.deleteMany({
        where: {
          roleId: roleRecord.id,
          permissionId: permRecord.id,
        },
      });
    },

    syncRolePermissions: async (
      role: string,
      permissions: string[],
      _context?: AuthContext
    ) => {
      const [roleRecord, permRecords] = await Promise.all([
        (prisma as any).permifyRole.findUniqueOrThrow({ where: { name: role } }),
        (prisma as any).permifyPermission.findMany({
          where: { name: { in: permissions } },
        }),
      ]);

      await (prisma as any).permifyRoleHasPermission.deleteMany({
        where: { roleId: roleRecord.id },
      });

      await (prisma as any).permifyRoleHasPermission.createMany({
        data: permRecords.map((p: any) => ({
          roleId: roleRecord.id,
          permissionId: p.id,
        })),
      });
    },
  };
}

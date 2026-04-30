"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  createPrismaResolver: () => createPrismaResolver,
  createPrismaWriteResolver: () => createPrismaWriteResolver
});
module.exports = __toCommonJS(index_exports);

// src/resolver.ts
function createPrismaResolver(prisma) {
  return {
    getRoles: async (model, _context) => {
      const results = await prisma.permifyModelHasRole.findMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? "User"
        },
        include: { role: true }
      });
      return results.map((r) => r.role.name);
    },
    getDirectPermissions: async (model, _context) => {
      const results = await prisma.permifyModelHasPermission.findMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? "User"
        },
        include: { permission: true }
      });
      return results.map((r) => r.permission.name);
    },
    getPermissionsThroughRoles: async (model, _context) => {
      const results = await prisma.permifyModelHasRole.findMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? "User"
        },
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true }
              }
            }
          }
        }
      });
      const permissions = results.flatMap((r) => r.role.permissions).map((p) => p.permission.name);
      return [...new Set(permissions)];
    },
    getRolePermissions: async (role, _context) => {
      const result = await prisma.permifyRole.findUnique({
        where: { name: role },
        include: {
          permissions: {
            include: { permission: true }
          }
        }
      });
      return result?.permissions.map((p) => p.permission.name) ?? [];
    }
  };
}

// src/writeResolver.ts
function createPrismaWriteResolver(prisma) {
  return {
    // ─── Model role assignment ──────────────────────────────────────
    assignRole: async (model, role, _context) => {
      const roleRecord = await prisma.permifyRole.findUniqueOrThrow({
        where: { name: role }
      });
      await prisma.permifyModelHasRole.upsert({
        where: {
          modelId_modelType_roleId: {
            modelId: model.id,
            modelType: model.modelType ?? "User",
            roleId: roleRecord.id
          }
        },
        create: {
          modelId: model.id,
          modelType: model.modelType ?? "User",
          roleId: roleRecord.id
        },
        update: {}
      });
    },
    removeRole: async (model, role, _context) => {
      const roleRecord = await prisma.permifyRole.findUnique({
        where: { name: role }
      });
      if (!roleRecord) return;
      await prisma.permifyModelHasRole.deleteMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? "User",
          roleId: roleRecord.id
        }
      });
    },
    syncRoles: async (model, roles, _context) => {
      const roleRecords = await prisma.permifyRole.findMany({
        where: { name: { in: roles } }
      });
      await prisma.permifyModelHasRole.deleteMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? "User"
        }
      });
      await prisma.permifyModelHasRole.createMany({
        data: roleRecords.map((r) => ({
          modelId: model.id,
          modelType: model.modelType ?? "User",
          roleId: r.id
        }))
      });
    },
    // ─── Model direct permission assignment ─────────────────────────
    givePermissionTo: async (model, permission, _context) => {
      const permRecord = await prisma.permifyPermission.findUniqueOrThrow({
        where: { name: permission }
      });
      await prisma.permifyModelHasPermission.upsert({
        where: {
          modelId_modelType_permissionId: {
            modelId: model.id,
            modelType: model.modelType ?? "User",
            permissionId: permRecord.id
          }
        },
        create: {
          modelId: model.id,
          modelType: model.modelType ?? "User",
          permissionId: permRecord.id
        },
        update: {}
      });
    },
    revokePermissionTo: async (model, permission, _context) => {
      const permRecord = await prisma.permifyPermission.findUnique({
        where: { name: permission }
      });
      if (!permRecord) return;
      await prisma.permifyModelHasPermission.deleteMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? "User",
          permissionId: permRecord.id
        }
      });
    },
    syncPermissions: async (model, permissions, _context) => {
      const permRecords = await prisma.permifyPermission.findMany({
        where: { name: { in: permissions } }
      });
      await prisma.permifyModelHasPermission.deleteMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? "User"
        }
      });
      await prisma.permifyModelHasPermission.createMany({
        data: permRecords.map((p) => ({
          modelId: model.id,
          modelType: model.modelType ?? "User",
          permissionId: p.id
        }))
      });
    },
    // ─── Role permission assignment ─────────────────────────────────
    assignPermissionToRole: async (role, permission, _context) => {
      const [roleRecord, permRecord] = await Promise.all([
        prisma.permifyRole.findUniqueOrThrow({ where: { name: role } }),
        prisma.permifyPermission.findUniqueOrThrow({ where: { name: permission } })
      ]);
      await prisma.permifyRoleHasPermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roleRecord.id,
            permissionId: permRecord.id
          }
        },
        create: {
          roleId: roleRecord.id,
          permissionId: permRecord.id
        },
        update: {}
      });
    },
    revokePermissionFromRole: async (role, permission, _context) => {
      const [roleRecord, permRecord] = await Promise.all([
        prisma.permifyRole.findUnique({ where: { name: role } }),
        prisma.permifyPermission.findUnique({ where: { name: permission } })
      ]);
      if (!roleRecord || !permRecord) return;
      await prisma.permifyRoleHasPermission.deleteMany({
        where: {
          roleId: roleRecord.id,
          permissionId: permRecord.id
        }
      });
    },
    syncRolePermissions: async (role, permissions, _context) => {
      const [roleRecord, permRecords] = await Promise.all([
        prisma.permifyRole.findUniqueOrThrow({ where: { name: role } }),
        prisma.permifyPermission.findMany({
          where: { name: { in: permissions } }
        })
      ]);
      await prisma.permifyRoleHasPermission.deleteMany({
        where: { roleId: roleRecord.id }
      });
      await prisma.permifyRoleHasPermission.createMany({
        data: permRecords.map((p) => ({
          roleId: roleRecord.id,
          permissionId: p.id
        }))
      });
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createPrismaResolver,
  createPrismaWriteResolver
});

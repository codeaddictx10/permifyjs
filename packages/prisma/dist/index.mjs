// src/scope.ts
var GLOBAL_SCOPE = "__permify_global__";
function getEnabledScopeFields(scopeMode) {
  switch (scopeMode ?? "tenant-team") {
    case "global":
      return [];
    case "tenant":
      return ["tenantId"];
    case "team":
      return ["teamId"];
    default:
      return ["tenantId", "teamId"];
  }
}
function normalizeScope(scopeMode, context) {
  const scope = {};
  for (const field of getEnabledScopeFields(scopeMode)) {
    scope[field] = context?.[field] ?? GLOBAL_SCOPE;
  }
  return scope;
}
function getScopedCompoundKeyName(prefix, suffix, scopeMode) {
  return [...prefix, ...getEnabledScopeFields(scopeMode), ...suffix].join("_");
}
function getScopedRoleWhereUnique(name, scopeMode, context) {
  const scope = normalizeScope(scopeMode, context);
  const keyName = getScopedCompoundKeyName(["name"], [], scopeMode);
  if (keyName === "name") {
    return { name };
  }
  return {
    [keyName]: {
      name,
      ...scope
    }
  };
}

// src/resolver.ts
function createPrismaResolver(prisma, options = {}) {
  return {
    getRoles: async (model, context) => {
      const scope = normalizeScope(options.scopeMode, context);
      const results = await prisma.permifyModelHasRole.findMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? "User",
          ...scope
        },
        include: { role: true }
      });
      return results.map((r) => r.role.name);
    },
    getDirectPermissions: async (model, context) => {
      const scope = normalizeScope(options.scopeMode, context);
      const results = await prisma.permifyModelHasPermission.findMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? "User",
          ...scope
        },
        include: { permission: true }
      });
      return results.map((r) => r.permission.name);
    },
    getPermissionsThroughRoles: async (model, context) => {
      const scope = normalizeScope(options.scopeMode, context);
      const roleAssignments = await prisma.permifyModelHasRole.findMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? "User",
          ...scope
        }
      });
      if (roleAssignments.length === 0) return [];
      const rolePermissions = await prisma.permifyRoleHasPermission.findMany({
        where: {
          roleId: { in: roleAssignments.map((assignment) => assignment.roleId) },
          ...scope
        },
        include: { permission: true }
      });
      const permissions = rolePermissions.map((link) => link.permission.name);
      return [...new Set(permissions)];
    },
    getRolePermissions: async (role, context) => {
      const roleRecord = await prisma.permifyRole.findUnique({
        where: getScopedRoleWhereUnique(role, options.scopeMode, context)
      });
      if (!roleRecord) return [];
      const scope = normalizeScope(options.scopeMode, context);
      const result = await prisma.permifyRoleHasPermission.findMany({
        where: {
          roleId: roleRecord.id,
          ...scope
        },
        include: { permission: true }
      });
      return result.map((link) => link.permission.name);
    }
  };
}

// src/writeResolver.ts
function createPrismaWriteResolver(prisma, options = {}) {
  return {
    // ─── Model role assignment ──────────────────────────────────────
    assignRole: async (model, role, context) => {
      const roleRecord = await prisma.permifyRole.findUniqueOrThrow({
        where: getScopedRoleWhereUnique(role, options.scopeMode, context)
      });
      const scope = normalizeScope(options.scopeMode, context);
      await prisma.permifyModelHasRole.upsert({
        where: {
          [getScopedCompoundKeyName(
            ["modelId", "modelType"],
            ["roleId"],
            options.scopeMode
          )]: {
            modelId: model.id,
            modelType: model.modelType ?? "User",
            ...scope,
            roleId: roleRecord.id
          }
        },
        create: {
          modelId: model.id,
          modelType: model.modelType ?? "User",
          ...scope,
          roleId: roleRecord.id
        },
        update: {}
      });
    },
    removeRole: async (model, role, context) => {
      const scope = normalizeScope(options.scopeMode, context);
      const roleRecord = await prisma.permifyRole.findUnique({
        where: getScopedRoleWhereUnique(role, options.scopeMode, context)
      });
      if (!roleRecord) return;
      await prisma.permifyModelHasRole.deleteMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? "User",
          ...scope,
          roleId: roleRecord.id
        }
      });
    },
    syncRoles: async (model, roles, context) => {
      const scope = normalizeScope(options.scopeMode, context);
      const roleRecords = await prisma.permifyRole.findMany({
        where: { name: { in: roles }, ...scope }
      });
      await prisma.permifyModelHasRole.deleteMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? "User",
          ...scope
        }
      });
      await prisma.permifyModelHasRole.createMany({
        data: roleRecords.map((r) => ({
          modelId: model.id,
          modelType: model.modelType ?? "User",
          ...scope,
          roleId: r.id
        }))
      });
    },
    // ─── Model direct permission assignment ─────────────────────────
    givePermissionTo: async (model, permission, context) => {
      const scope = normalizeScope(options.scopeMode, context);
      const permRecord = await prisma.permifyPermission.findUniqueOrThrow({
        where: { name: permission }
      });
      await prisma.permifyModelHasPermission.upsert({
        where: {
          [getScopedCompoundKeyName(
            ["modelId", "modelType"],
            ["permissionId"],
            options.scopeMode
          )]: {
            modelId: model.id,
            modelType: model.modelType ?? "User",
            ...scope,
            permissionId: permRecord.id
          }
        },
        create: {
          modelId: model.id,
          modelType: model.modelType ?? "User",
          ...scope,
          permissionId: permRecord.id
        },
        update: {}
      });
    },
    revokePermissionTo: async (model, permission, context) => {
      const scope = normalizeScope(options.scopeMode, context);
      const permRecord = await prisma.permifyPermission.findUnique({
        where: { name: permission }
      });
      if (!permRecord) return;
      await prisma.permifyModelHasPermission.deleteMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? "User",
          ...scope,
          permissionId: permRecord.id
        }
      });
    },
    syncPermissions: async (model, permissions, context) => {
      const scope = normalizeScope(options.scopeMode, context);
      const permRecords = await prisma.permifyPermission.findMany({
        where: { name: { in: permissions } }
      });
      await prisma.permifyModelHasPermission.deleteMany({
        where: {
          modelId: model.id,
          modelType: model.modelType ?? "User",
          ...scope
        }
      });
      await prisma.permifyModelHasPermission.createMany({
        data: permRecords.map((p) => ({
          modelId: model.id,
          modelType: model.modelType ?? "User",
          ...scope,
          permissionId: p.id
        }))
      });
    },
    // ─── Role permission assignment ─────────────────────────────────
    assignPermissionToRole: async (role, permission, context) => {
      const scope = normalizeScope(options.scopeMode, context);
      const [roleRecord, permRecord] = await Promise.all([
        prisma.permifyRole.findUniqueOrThrow({
          where: getScopedRoleWhereUnique(role, options.scopeMode, context)
        }),
        prisma.permifyPermission.findUniqueOrThrow({ where: { name: permission } })
      ]);
      await prisma.permifyRoleHasPermission.upsert({
        where: {
          [getScopedCompoundKeyName(
            ["roleId", "permissionId"],
            [],
            options.scopeMode
          )]: {
            roleId: roleRecord.id,
            permissionId: permRecord.id,
            ...scope
          }
        },
        create: {
          roleId: roleRecord.id,
          permissionId: permRecord.id,
          ...scope
        },
        update: {}
      });
    },
    revokePermissionFromRole: async (role, permission, context) => {
      const scope = normalizeScope(options.scopeMode, context);
      const [roleRecord, permRecord] = await Promise.all([
        prisma.permifyRole.findUnique({
          where: getScopedRoleWhereUnique(role, options.scopeMode, context)
        }),
        prisma.permifyPermission.findUnique({ where: { name: permission } })
      ]);
      if (!roleRecord || !permRecord) return;
      await prisma.permifyRoleHasPermission.deleteMany({
        where: {
          roleId: roleRecord.id,
          permissionId: permRecord.id,
          ...scope
        }
      });
    },
    syncRolePermissions: async (role, permissions, context) => {
      const scope = normalizeScope(options.scopeMode, context);
      const [roleRecord, permRecords] = await Promise.all([
        prisma.permifyRole.findUniqueOrThrow({
          where: getScopedRoleWhereUnique(role, options.scopeMode, context)
        }),
        prisma.permifyPermission.findMany({
          where: { name: { in: permissions } }
        })
      ]);
      await prisma.permifyRoleHasPermission.deleteMany({
        where: {
          roleId: roleRecord.id,
          ...scope
        }
      });
      await prisma.permifyRoleHasPermission.createMany({
        data: permRecords.map((p) => ({
          roleId: roleRecord.id,
          permissionId: p.id,
          ...scope
        }))
      });
    }
  };
}
export {
  createPrismaResolver,
  createPrismaWriteResolver
};

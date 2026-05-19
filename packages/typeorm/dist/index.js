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
  GLOBAL_SCOPE: () => GLOBAL_SCOPE,
  createPermifyRecord: () => createPermifyRecord,
  createTypeOrmResolver: () => createTypeOrmResolver,
  createTypeOrmWriteResolver: () => createTypeOrmWriteResolver,
  dropPermifySchema: () => dropPermifySchema,
  getEnabledScopeFields: () => getEnabledScopeFields,
  getPermifySchemaStatus: () => getPermifySchemaStatus,
  getPermifyTableNames: () => getPermifyTableNames,
  normalizeScope: () => normalizeScope,
  syncPermifySchema: () => syncPermifySchema
});
module.exports = __toCommonJS(index_exports);

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

// src/schema.ts
var import_typeorm = require("typeorm");
var DEFAULT_TABLE_NAMES = {
  roles: "roles",
  permissions: "permissions",
  roleHasPermissions: "role_has_permissions",
  modelHasRoles: "model_has_roles",
  modelHasPermissions: "model_has_permissions"
};
function getTimestampColumnType(dataSource) {
  const type = dataSource.options.type;
  switch (type) {
    case "postgres":
    case "cockroachdb":
      return "timestamp";
    default:
      return "datetime";
  }
}
function getScopeColumns(scopeMode) {
  return getEnabledScopeFields(scopeMode).map((field) => ({
    name: field,
    type: "varchar",
    isNullable: false,
    default: `'${GLOBAL_SCOPE}'`
  }));
}
function createCompositeUnique(name, columnNames) {
  return {
    name,
    columnNames
  };
}
function createRolesTable(dataSource, tableNames, scopeMode) {
  const timestampType = getTimestampColumnType(dataSource);
  const scopeColumns = getEnabledScopeFields(scopeMode);
  return new import_typeorm.Table({
    name: tableNames.roles,
    columns: [
      {
        name: "id",
        type: "varchar",
        isPrimary: true
      },
      {
        name: "name",
        type: "varchar",
        isNullable: false
      },
      ...getScopeColumns(scopeMode),
      {
        name: "createdAt",
        type: timestampType,
        isNullable: false,
        default: "CURRENT_TIMESTAMP"
      },
      {
        name: "updatedAt",
        type: timestampType,
        isNullable: false,
        default: "CURRENT_TIMESTAMP"
      }
    ],
    uniques: [
      createCompositeUnique("permify_roles_name_unique", ["name", ...scopeColumns])
    ]
  });
}
function createPermissionsTable(dataSource, tableNames) {
  const timestampType = getTimestampColumnType(dataSource);
  return new import_typeorm.Table({
    name: tableNames.permissions,
    columns: [
      {
        name: "id",
        type: "varchar",
        isPrimary: true
      },
      {
        name: "name",
        type: "varchar",
        isNullable: false
      },
      {
        name: "createdAt",
        type: timestampType,
        isNullable: false,
        default: "CURRENT_TIMESTAMP"
      },
      {
        name: "updatedAt",
        type: timestampType,
        isNullable: false,
        default: "CURRENT_TIMESTAMP"
      }
    ],
    uniques: [
      createCompositeUnique("permify_permissions_name_unique", ["name"])
    ]
  });
}
function createRoleHasPermissionsTable(tableNames, scopeMode) {
  const scopeColumns = getEnabledScopeFields(scopeMode);
  return new import_typeorm.Table({
    name: tableNames.roleHasPermissions,
    columns: [
      {
        name: "roleId",
        type: "varchar",
        isNullable: false
      },
      {
        name: "permissionId",
        type: "varchar",
        isNullable: false
      },
      ...getScopeColumns(scopeMode)
    ],
    uniques: [
      createCompositeUnique("permify_role_has_permissions_unique", [
        "roleId",
        "permissionId",
        ...scopeColumns
      ])
    ],
    foreignKeys: [
      {
        columnNames: ["roleId"],
        referencedTableName: tableNames.roles,
        referencedColumnNames: ["id"],
        onDelete: "CASCADE"
      },
      {
        columnNames: ["permissionId"],
        referencedTableName: tableNames.permissions,
        referencedColumnNames: ["id"],
        onDelete: "CASCADE"
      }
    ]
  });
}
function createModelHasRolesTable(tableNames, scopeMode) {
  const scopeColumns = getEnabledScopeFields(scopeMode);
  return new import_typeorm.Table({
    name: tableNames.modelHasRoles,
    columns: [
      {
        name: "modelId",
        type: "varchar",
        isNullable: false
      },
      {
        name: "modelType",
        type: "varchar",
        isNullable: false
      },
      ...getScopeColumns(scopeMode),
      {
        name: "roleId",
        type: "varchar",
        isNullable: false
      }
    ],
    uniques: [
      createCompositeUnique("permify_model_has_roles_unique", [
        "modelId",
        "modelType",
        ...scopeColumns,
        "roleId"
      ])
    ],
    foreignKeys: [
      {
        columnNames: ["roleId"],
        referencedTableName: tableNames.roles,
        referencedColumnNames: ["id"],
        onDelete: "CASCADE"
      }
    ]
  });
}
function createModelHasPermissionsTable(tableNames, scopeMode) {
  const scopeColumns = getEnabledScopeFields(scopeMode);
  return new import_typeorm.Table({
    name: tableNames.modelHasPermissions,
    columns: [
      {
        name: "modelId",
        type: "varchar",
        isNullable: false
      },
      {
        name: "modelType",
        type: "varchar",
        isNullable: false
      },
      ...getScopeColumns(scopeMode),
      {
        name: "permissionId",
        type: "varchar",
        isNullable: false
      }
    ],
    uniques: [
      createCompositeUnique("permify_model_has_permissions_unique", [
        "modelId",
        "modelType",
        ...scopeColumns,
        "permissionId"
      ])
    ],
    foreignKeys: [
      {
        columnNames: ["permissionId"],
        referencedTableName: tableNames.permissions,
        referencedColumnNames: ["id"],
        onDelete: "CASCADE"
      }
    ]
  });
}
function getPermifyTableNames(tableNames) {
  return {
    ...DEFAULT_TABLE_NAMES,
    ...tableNames
  };
}
async function getPermifySchemaStatus(dataSource, options = {}) {
  const tableNames = getPermifyTableNames(options.tableNames);
  const queryRunner = dataSource.createQueryRunner();
  try {
    const tables = {
      roles: await queryRunner.hasTable(tableNames.roles),
      permissions: await queryRunner.hasTable(tableNames.permissions),
      roleHasPermissions: await queryRunner.hasTable(tableNames.roleHasPermissions),
      modelHasRoles: await queryRunner.hasTable(tableNames.modelHasRoles),
      modelHasPermissions: await queryRunner.hasTable(tableNames.modelHasPermissions)
    };
    return {
      allPresent: Object.values(tables).every(Boolean),
      tables
    };
  } finally {
    await queryRunner.release();
  }
}
async function syncPermifySchema(dataSource, options = {}) {
  const tableNames = getPermifyTableNames(options.tableNames);
  const queryRunner = dataSource.createQueryRunner();
  try {
    await queryRunner.createTable(
      createRolesTable(dataSource, tableNames, options.scopeMode),
      true
    );
    await queryRunner.createTable(
      createPermissionsTable(dataSource, tableNames),
      true
    );
    await queryRunner.createTable(
      createRoleHasPermissionsTable(tableNames, options.scopeMode),
      true
    );
    await queryRunner.createTable(
      createModelHasRolesTable(tableNames, options.scopeMode),
      true
    );
    await queryRunner.createTable(
      createModelHasPermissionsTable(tableNames, options.scopeMode),
      true
    );
  } finally {
    await queryRunner.release();
  }
}
async function dropPermifySchema(dataSource, options = {}) {
  const tableNames = getPermifyTableNames(options.tableNames);
  const queryRunner = dataSource.createQueryRunner();
  try {
    await queryRunner.dropTable(tableNames.modelHasPermissions, true, true, true);
    await queryRunner.dropTable(tableNames.modelHasRoles, true, true, true);
    await queryRunner.dropTable(tableNames.roleHasPermissions, true, true, true);
    await queryRunner.dropTable(tableNames.permissions, true, true, true);
    await queryRunner.dropTable(tableNames.roles, true, true, true);
  } finally {
    await queryRunner.release();
  }
}

// src/resolver.ts
function normalizeModel(model) {
  return {
    ...model,
    modelType: model.modelType ?? "User"
  };
}
function applyScopeWhere(qb, alias, scope, prefix) {
  for (const [field, value] of Object.entries(scope)) {
    qb.andWhere(`${alias}.${field} = :${prefix}${field}`, {
      [`${prefix}${field}`]: value
    });
  }
}
async function findRoleIdByName(dataSource, roleName, options, context) {
  const tableNames = getPermifyTableNames(options.tableNames);
  const scope = normalizeScope(options.scopeMode, context);
  const qb = dataSource.createQueryBuilder().select("role.id", "id").from(tableNames.roles, "role").where("role.name = :name", { name: roleName });
  applyScopeWhere(qb, "role", scope, "roleScope_");
  const row = await qb.getRawOne();
  return row?.id ?? null;
}
function createTypeOrmResolver(dataSource, options = {}) {
  const tableNames = getPermifyTableNames(options.tableNames);
  return {
    async getRoles(model, context) {
      const normalized = normalizeModel(model);
      const scope = normalizeScope(options.scopeMode, context);
      const qb = dataSource.createQueryBuilder().select("role.name", "name").from(tableNames.modelHasRoles, "assignment").innerJoin(
        tableNames.roles,
        "role",
        "role.id = assignment.roleId"
      ).where("assignment.modelId = :modelId", { modelId: normalized.id }).andWhere("assignment.modelType = :modelType", {
        modelType: normalized.modelType
      }).orderBy("role.name", "ASC");
      applyScopeWhere(qb, "assignment", scope, "assignmentScope_");
      const rows = await qb.getRawMany();
      return rows.map((row) => row.name);
    },
    async getDirectPermissions(model, context) {
      const normalized = normalizeModel(model);
      const scope = normalizeScope(options.scopeMode, context);
      const qb = dataSource.createQueryBuilder().select("permission.name", "name").from(tableNames.modelHasPermissions, "assignment").innerJoin(
        tableNames.permissions,
        "permission",
        "permission.id = assignment.permissionId"
      ).where("assignment.modelId = :modelId", { modelId: normalized.id }).andWhere("assignment.modelType = :modelType", {
        modelType: normalized.modelType
      }).orderBy("permission.name", "ASC");
      applyScopeWhere(qb, "assignment", scope, "assignmentScope_");
      const rows = await qb.getRawMany();
      return rows.map((row) => row.name);
    },
    async getPermissionsThroughRoles(model, context) {
      const normalized = normalizeModel(model);
      const scope = normalizeScope(options.scopeMode, context);
      const qb = dataSource.createQueryBuilder().select("permission.name", "name").from(tableNames.modelHasRoles, "assignment").innerJoin(
        tableNames.roleHasPermissions,
        "link",
        "link.roleId = assignment.roleId"
      ).innerJoin(
        tableNames.permissions,
        "permission",
        "permission.id = link.permissionId"
      ).where("assignment.modelId = :modelId", { modelId: normalized.id }).andWhere("assignment.modelType = :modelType", {
        modelType: normalized.modelType
      }).orderBy("permission.name", "ASC");
      applyScopeWhere(qb, "assignment", scope, "assignmentScope_");
      applyScopeWhere(qb, "link", scope, "linkScope_");
      const rows = await qb.getRawMany();
      return [...new Set(rows.map((row) => row.name))];
    },
    async getRolePermissions(role, context) {
      const roleId = await findRoleIdByName(dataSource, role, options, context);
      if (!roleId) return [];
      const scope = normalizeScope(options.scopeMode, context);
      const qb = dataSource.createQueryBuilder().select("permission.name", "name").from(tableNames.roleHasPermissions, "link").innerJoin(
        tableNames.permissions,
        "permission",
        "permission.id = link.permissionId"
      ).where("link.roleId = :roleId", { roleId }).orderBy("permission.name", "ASC");
      applyScopeWhere(qb, "link", scope, "linkScope_");
      const rows = await qb.getRawMany();
      return rows.map((row) => row.name);
    }
  };
}

// src/writeResolver.ts
var import_node_crypto = require("crypto");
function normalizeModel2(model) {
  return {
    ...model,
    modelType: model.modelType ?? "User"
  };
}
async function findIdByNameOrThrow(dataSource, tableName, value, label, scope) {
  const qb = dataSource.createQueryBuilder().select("record.id", "id").from(tableName, "record").where("record.name = :name", { name: value });
  for (const [field, fieldValue] of Object.entries(scope ?? {})) {
    qb.andWhere(`record.${field} = :${field}`, { [field]: fieldValue });
  }
  const row = await qb.getRawOne();
  if (!row?.id) {
    throw new Error(`[permifyjs] ${label} "${value}" not found`);
  }
  return row.id;
}
async function findIdByName(dataSource, tableName, value, scope) {
  const qb = dataSource.createQueryBuilder().select("record.id", "id").from(tableName, "record").where("record.name = :name", { name: value });
  for (const [field, fieldValue] of Object.entries(scope ?? {})) {
    qb.andWhere(`record.${field} = :${field}`, { [field]: fieldValue });
  }
  const row = await qb.getRawOne();
  return row?.id ?? null;
}
function createTypeOrmWriteResolver(dataSource, options = {}) {
  const tableNames = getPermifyTableNames(options.tableNames);
  return {
    async assignRole(model, role, context) {
      const normalized = normalizeModel2(model);
      const scope = normalizeScope(options.scopeMode, context);
      const roleId = await findIdByNameOrThrow(
        dataSource,
        tableNames.roles,
        role,
        "role",
        scope
      );
      await dataSource.createQueryBuilder().insert().into(tableNames.modelHasRoles).values({
        modelId: normalized.id,
        modelType: normalized.modelType,
        roleId,
        ...scope
      }).orIgnore().execute();
    },
    async removeRole(model, role, context) {
      const normalized = normalizeModel2(model);
      const scope = normalizeScope(options.scopeMode, context);
      const roleId = await findIdByName(dataSource, tableNames.roles, role, scope);
      if (!roleId) return;
      const deleteQuery = dataSource.createQueryBuilder().delete().from(tableNames.modelHasRoles).where("modelId = :modelId", { modelId: normalized.id }).andWhere("modelType = :modelType", { modelType: normalized.modelType }).andWhere("roleId = :roleId", { roleId });
      for (const [field, value] of Object.entries(scope)) {
        deleteQuery.andWhere(`${field} = :${field}`, { [field]: value });
      }
      await deleteQuery.execute();
    },
    async syncRoles(model, roles, context) {
      const normalized = normalizeModel2(model);
      const scope = normalizeScope(options.scopeMode, context);
      const deleteQuery = dataSource.createQueryBuilder().delete().from(tableNames.modelHasRoles).where("modelId = :modelId", { modelId: normalized.id }).andWhere("modelType = :modelType", { modelType: normalized.modelType });
      for (const [field, value] of Object.entries(scope)) {
        deleteQuery.andWhere(`${field} = :${field}`, { [field]: value });
      }
      await deleteQuery.execute();
      if (roles.length === 0) return;
      const roleQuery = dataSource.createQueryBuilder().select("role.id", "id").from(tableNames.roles, "role").where("role.name IN (:...names)", { names: roles });
      for (const [field, value] of Object.entries(scope)) {
        roleQuery.andWhere(`role.${field} = :${field}`, { [field]: value });
      }
      const roleRows = await roleQuery.getRawMany();
      if (roleRows.length === 0) return;
      await dataSource.createQueryBuilder().insert().into(tableNames.modelHasRoles).values(
        roleRows.map((row) => ({
          modelId: normalized.id,
          modelType: normalized.modelType,
          roleId: row.id,
          ...scope
        }))
      ).orIgnore().execute();
    },
    async givePermissionTo(model, permission, context) {
      const normalized = normalizeModel2(model);
      const permissionId = await findIdByNameOrThrow(
        dataSource,
        tableNames.permissions,
        permission,
        "permission"
      );
      const scope = normalizeScope(options.scopeMode, context);
      await dataSource.createQueryBuilder().insert().into(tableNames.modelHasPermissions).values({
        modelId: normalized.id,
        modelType: normalized.modelType,
        permissionId,
        ...scope
      }).orIgnore().execute();
    },
    async revokePermissionTo(model, permission, context) {
      const normalized = normalizeModel2(model);
      const permissionId = await findIdByName(
        dataSource,
        tableNames.permissions,
        permission
      );
      if (!permissionId) return;
      const scope = normalizeScope(options.scopeMode, context);
      const deleteQuery = dataSource.createQueryBuilder().delete().from(tableNames.modelHasPermissions).where("modelId = :modelId", { modelId: normalized.id }).andWhere("modelType = :modelType", { modelType: normalized.modelType }).andWhere("permissionId = :permissionId", { permissionId });
      for (const [field, value] of Object.entries(scope)) {
        deleteQuery.andWhere(`${field} = :${field}`, { [field]: value });
      }
      await deleteQuery.execute();
    },
    async syncPermissions(model, permissions, context) {
      const normalized = normalizeModel2(model);
      const scope = normalizeScope(options.scopeMode, context);
      const deleteQuery = dataSource.createQueryBuilder().delete().from(tableNames.modelHasPermissions).where("modelId = :modelId", { modelId: normalized.id }).andWhere("modelType = :modelType", { modelType: normalized.modelType });
      for (const [field, value] of Object.entries(scope)) {
        deleteQuery.andWhere(`${field} = :${field}`, { [field]: value });
      }
      await deleteQuery.execute();
      if (permissions.length === 0) return;
      const permissionRows = await dataSource.createQueryBuilder().select("permission.id", "id").from(tableNames.permissions, "permission").where("permission.name IN (:...names)", { names: permissions }).getRawMany();
      if (permissionRows.length === 0) return;
      await dataSource.createQueryBuilder().insert().into(tableNames.modelHasPermissions).values(
        permissionRows.map((row) => ({
          modelId: normalized.id,
          modelType: normalized.modelType,
          permissionId: row.id,
          ...scope
        }))
      ).orIgnore().execute();
    },
    async assignPermissionToRole(role, permission, context) {
      const scope = normalizeScope(options.scopeMode, context);
      const [roleId, permissionId] = await Promise.all([
        findIdByNameOrThrow(dataSource, tableNames.roles, role, "role", scope),
        findIdByNameOrThrow(
          dataSource,
          tableNames.permissions,
          permission,
          "permission"
        )
      ]);
      await dataSource.createQueryBuilder().insert().into(tableNames.roleHasPermissions).values({
        roleId,
        permissionId,
        ...scope
      }).orIgnore().execute();
    },
    async revokePermissionFromRole(role, permission, context) {
      const scope = normalizeScope(options.scopeMode, context);
      const [roleId, permissionId] = await Promise.all([
        findIdByName(dataSource, tableNames.roles, role, scope),
        findIdByName(dataSource, tableNames.permissions, permission)
      ]);
      if (!roleId || !permissionId) return;
      const deleteQuery = dataSource.createQueryBuilder().delete().from(tableNames.roleHasPermissions).where("roleId = :roleId", { roleId }).andWhere("permissionId = :permissionId", { permissionId });
      for (const [field, value] of Object.entries(scope)) {
        deleteQuery.andWhere(`${field} = :${field}`, { [field]: value });
      }
      await deleteQuery.execute();
    },
    async syncRolePermissions(role, permissions, context) {
      const scope = normalizeScope(options.scopeMode, context);
      const roleId = await findIdByNameOrThrow(
        dataSource,
        tableNames.roles,
        role,
        "role",
        scope
      );
      const deleteQuery = dataSource.createQueryBuilder().delete().from(tableNames.roleHasPermissions).where("roleId = :roleId", { roleId });
      for (const [field, value] of Object.entries(scope)) {
        deleteQuery.andWhere(`${field} = :${field}`, { [field]: value });
      }
      await deleteQuery.execute();
      if (permissions.length === 0) return;
      const permissionRows = await dataSource.createQueryBuilder().select("permission.id", "id").from(tableNames.permissions, "permission").where("permission.name IN (:...names)", { names: permissions }).getRawMany();
      if (permissionRows.length === 0) return;
      await dataSource.createQueryBuilder().insert().into(tableNames.roleHasPermissions).values(
        permissionRows.map((row) => ({
          roleId,
          permissionId: row.id,
          ...scope
        }))
      ).orIgnore().execute();
    }
  };
}
async function createPermifyRecord(dataSource, tableName, name) {
  const existingId = await findIdByName(dataSource, tableName, name);
  if (existingId) return "exists";
  await dataSource.createQueryBuilder().insert().into(tableName).values({
    id: (0, import_node_crypto.randomUUID)(),
    name
  }).execute();
  return "created";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GLOBAL_SCOPE,
  createPermifyRecord,
  createTypeOrmResolver,
  createTypeOrmWriteResolver,
  dropPermifySchema,
  getEnabledScopeFields,
  getPermifySchemaStatus,
  getPermifyTableNames,
  normalizeScope,
  syncPermifySchema
});

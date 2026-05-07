"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  createMongooseResolver: () => createMongooseResolver,
  createMongooseWriteResolver: () => createMongooseWriteResolver,
  registerPermifyModels: () => registerPermifyModels
});
module.exports = __toCommonJS(index_exports);

// src/models.ts
var import_mongoose = __toESM(require("mongoose"));

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
function getScopedIndexShape(prefix, suffix, scopeMode) {
  const index = { ...prefix };
  for (const field of getEnabledScopeFields(scopeMode)) {
    index[field] = 1;
  }
  return {
    ...index,
    ...suffix
  };
}

// src/models.ts
var DEFAULT_MODEL_NAMES = {
  role: "PermifyRole",
  permission: "PermifyPermission",
  roleHasPermission: "PermifyRoleHasPermission",
  modelHasRole: "PermifyModelHasRole",
  modelHasPermission: "PermifyModelHasPermission"
};
var DEFAULT_COLLECTIONS = {
  roles: "roles",
  permissions: "permissions",
  roleHasPermissions: "role_has_permissions",
  modelHasRoles: "model_has_roles",
  modelHasPermissions: "model_has_permissions"
};
function getRegistry(options = {}) {
  return options.connection ?? options.mongoose ?? import_mongoose.default;
}
function getCollectionName(key, options) {
  return options?.collectionNames?.[key] ?? DEFAULT_COLLECTIONS[key];
}
var REGISTRY_SCOPE_MODE = /* @__PURE__ */ Symbol.for("permifyjs.scopeMode");
function getEnabledScopeFields2(scopeMode) {
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
function getResolvedScopeMode(options) {
  return options?.scopeMode ?? "tenant-team";
}
function getScopeSchemaFields(scopeMode) {
  const fields = {};
  for (const field of getEnabledScopeFields2(scopeMode)) {
    fields[field] = {
      type: String,
      required: true,
      default: GLOBAL_SCOPE,
      index: true
    };
  }
  return fields;
}
function assertRegistryScopeMode(registry, scopeMode) {
  const existingScopeMode = registry[REGISTRY_SCOPE_MODE];
  if (existingScopeMode && existingScopeMode !== scopeMode) {
    throw new Error(
      `[permifyjs] registerPermifyModels() already initialized this Mongoose registry with scopeMode "${existingScopeMode}". Received "${scopeMode}".`
    );
  }
  registry[REGISTRY_SCOPE_MODE] = scopeMode;
}
function createRoleSchema(collectionName) {
  return new import_mongoose.Schema(
    {
      name: { type: String, required: true, unique: true, index: true }
    },
    {
      timestamps: true,
      collection: collectionName
    }
  );
}
function createPermissionSchema(collectionName) {
  return new import_mongoose.Schema(
    {
      name: { type: String, required: true, unique: true, index: true }
    },
    {
      timestamps: true,
      collection: collectionName
    }
  );
}
function createRoleHasPermissionSchema(collectionName, scopeMode) {
  const schema = new import_mongoose.Schema(
    {
      roleId: {
        type: import_mongoose.Schema.Types.ObjectId,
        ref: DEFAULT_MODEL_NAMES.role,
        required: true,
        index: true
      },
      permissionId: {
        type: import_mongoose.Schema.Types.ObjectId,
        ref: DEFAULT_MODEL_NAMES.permission,
        required: true,
        index: true
      },
      ...getScopeSchemaFields(scopeMode)
    },
    {
      timestamps: false,
      collection: collectionName
    }
  );
  schema.index(
    getScopedIndexShape({ roleId: 1, permissionId: 1 }, {}, scopeMode),
    { unique: true }
  );
  return schema;
}
function createModelHasRoleSchema(collectionName, scopeMode) {
  const schema = new import_mongoose.Schema(
    {
      modelId: { type: String, required: true, index: true },
      modelType: { type: String, required: true, index: true },
      ...getScopeSchemaFields(scopeMode),
      roleId: {
        type: import_mongoose.Schema.Types.ObjectId,
        ref: DEFAULT_MODEL_NAMES.role,
        required: true,
        index: true
      }
    },
    {
      timestamps: false,
      collection: collectionName
    }
  );
  schema.index(
    getScopedIndexShape({ modelId: 1, modelType: 1 }, { roleId: 1 }, scopeMode),
    { unique: true }
  );
  return schema;
}
function createModelHasPermissionSchema(collectionName, scopeMode) {
  const schema = new import_mongoose.Schema(
    {
      modelId: { type: String, required: true, index: true },
      modelType: { type: String, required: true, index: true },
      ...getScopeSchemaFields(scopeMode),
      permissionId: {
        type: import_mongoose.Schema.Types.ObjectId,
        ref: DEFAULT_MODEL_NAMES.permission,
        required: true,
        index: true
      }
    },
    {
      timestamps: false,
      collection: collectionName
    }
  );
  schema.index(
    getScopedIndexShape(
      { modelId: 1, modelType: 1 },
      { permissionId: 1 },
      scopeMode
    ),
    { unique: true }
  );
  return schema;
}
function registerPermifyModels(options = {}) {
  const registry = getRegistry(options);
  const scopeMode = getResolvedScopeMode(options);
  assertRegistryScopeMode(registry, scopeMode);
  const Role = registry.models[DEFAULT_MODEL_NAMES.role] ?? registry.model(
    DEFAULT_MODEL_NAMES.role,
    createRoleSchema(getCollectionName("roles", options))
  );
  const Permission = registry.models[DEFAULT_MODEL_NAMES.permission] ?? registry.model(
    DEFAULT_MODEL_NAMES.permission,
    createPermissionSchema(getCollectionName("permissions", options))
  );
  const RoleHasPermission = registry.models[DEFAULT_MODEL_NAMES.roleHasPermission] ?? registry.model(
    DEFAULT_MODEL_NAMES.roleHasPermission,
    createRoleHasPermissionSchema(
      getCollectionName("roleHasPermissions", options),
      scopeMode
    )
  );
  const ModelHasRole = registry.models[DEFAULT_MODEL_NAMES.modelHasRole] ?? registry.model(
    DEFAULT_MODEL_NAMES.modelHasRole,
    createModelHasRoleSchema(getCollectionName("modelHasRoles", options), scopeMode)
  );
  const ModelHasPermission = registry.models[DEFAULT_MODEL_NAMES.modelHasPermission] ?? registry.model(
    DEFAULT_MODEL_NAMES.modelHasPermission,
    createModelHasPermissionSchema(
      getCollectionName("modelHasPermissions", options),
      scopeMode
    )
  );
  return {
    Role,
    Permission,
    RoleHasPermission,
    ModelHasRole,
    ModelHasPermission
  };
}

// src/resolver.ts
function normalizeModel(model) {
  return {
    ...model,
    modelType: model.modelType ?? "User"
  };
}
function createMongooseResolver(options = {}) {
  const models = registerPermifyModels(options);
  return {
    async getRoles(model, context) {
      const normalized = normalizeModel(model);
      const scope = normalizeScope(options.scopeMode, context);
      const assignments = await models.ModelHasRole.find({
        modelId: normalized.id,
        modelType: normalized.modelType,
        ...scope
      }).lean();
      if (assignments.length === 0) return [];
      const roleIds = assignments.map((assignment) => assignment.roleId);
      const roles = await models.Role.find({ _id: { $in: roleIds } }).select({ name: 1, _id: 0 }).lean();
      return roles.map((role) => role.name);
    },
    async getDirectPermissions(model, context) {
      const normalized = normalizeModel(model);
      const scope = normalizeScope(options.scopeMode, context);
      const assignments = await models.ModelHasPermission.find({
        modelId: normalized.id,
        modelType: normalized.modelType,
        ...scope
      }).lean();
      if (assignments.length === 0) return [];
      const permissionIds = assignments.map((assignment) => assignment.permissionId);
      const permissions = await models.Permission.find({
        _id: { $in: permissionIds }
      }).select({ name: 1, _id: 0 }).lean();
      return permissions.map((permission) => permission.name);
    },
    async getPermissionsThroughRoles(model, context) {
      const normalized = normalizeModel(model);
      const scope = normalizeScope(options.scopeMode, context);
      const assignments = await models.ModelHasRole.find({
        modelId: normalized.id,
        modelType: normalized.modelType,
        ...scope
      }).lean();
      if (assignments.length === 0) return [];
      const roleIds = assignments.map((assignment) => assignment.roleId);
      const rolePermissionLinks = await models.RoleHasPermission.find({
        roleId: { $in: roleIds },
        ...scope
      }).lean();
      if (rolePermissionLinks.length === 0) return [];
      const permissionIds = rolePermissionLinks.map((link) => link.permissionId);
      const permissions = await models.Permission.find({
        _id: { $in: permissionIds }
      }).select({ name: 1, _id: 0 }).lean();
      return [...new Set(permissions.map((permission) => permission.name))];
    },
    async getRolePermissions(role, context) {
      const scope = normalizeScope(options.scopeMode, context);
      const roleDoc = await models.Role.findOne({ name: role }).lean();
      if (!roleDoc?._id) return [];
      const links = await models.RoleHasPermission.find({
        roleId: roleDoc._id,
        ...scope
      }).lean();
      if (links.length === 0) return [];
      const permissionIds = links.map((link) => link.permissionId);
      const permissions = await models.Permission.find({
        _id: { $in: permissionIds }
      }).select({ name: 1, _id: 0 }).lean();
      return permissions.map((permission) => permission.name);
    }
  };
}

// src/writeResolver.ts
function normalizeModel2(model) {
  return {
    ...model,
    modelType: model.modelType ?? "User"
  };
}
async function findRoleIdOrThrow(roleName, options) {
  const { Role } = registerPermifyModels(options);
  const role = await Role.findOne({ name: roleName }).lean();
  if (!role?._id) {
    throw new Error(`[permifyjs] role "${roleName}" not found`);
  }
  return role._id;
}
async function findPermissionIdOrThrow(permissionName, options) {
  const { Permission } = registerPermifyModels(options);
  const permission = await Permission.findOne({ name: permissionName }).lean();
  if (!permission?._id) {
    throw new Error(`[permifyjs] permission "${permissionName}" not found`);
  }
  return permission._id;
}
function createMongooseWriteResolver(options = {}) {
  const models = registerPermifyModels(options);
  return {
    async assignRole(model, role, context) {
      const normalized = normalizeModel2(model);
      const scope = normalizeScope(options.scopeMode, context);
      const roleId = await findRoleIdOrThrow(role, options);
      await models.ModelHasRole.updateOne(
        {
          modelId: normalized.id,
          modelType: normalized.modelType,
          ...scope,
          roleId
        },
        {
          $setOnInsert: {
            modelId: normalized.id,
            modelType: normalized.modelType,
            ...scope,
            roleId
          }
        },
        { upsert: true }
      );
    },
    async removeRole(model, role, context) {
      const normalized = normalizeModel2(model);
      const scope = normalizeScope(options.scopeMode, context);
      const roleDoc = await models.Role.findOne({ name: role }).lean();
      if (!roleDoc?._id) return;
      await models.ModelHasRole.deleteMany({
        modelId: normalized.id,
        modelType: normalized.modelType,
        ...scope,
        roleId: roleDoc._id
      });
    },
    async syncRoles(model, roles, context) {
      const normalized = normalizeModel2(model);
      const scope = normalizeScope(options.scopeMode, context);
      const roleDocs = await models.Role.find({ name: { $in: roles } }).select({ _id: 1 }).lean();
      await models.ModelHasRole.deleteMany({
        modelId: normalized.id,
        modelType: normalized.modelType,
        ...scope
      });
      if (roleDocs.length === 0) return;
      await models.ModelHasRole.insertMany(
        roleDocs.map((roleDoc) => ({
          modelId: normalized.id,
          modelType: normalized.modelType,
          ...scope,
          roleId: roleDoc._id
        }))
      );
    },
    async givePermissionTo(model, permission, context) {
      const normalized = normalizeModel2(model);
      const scope = normalizeScope(options.scopeMode, context);
      const permissionId = await findPermissionIdOrThrow(permission, options);
      await models.ModelHasPermission.updateOne(
        {
          modelId: normalized.id,
          modelType: normalized.modelType,
          ...scope,
          permissionId
        },
        {
          $setOnInsert: {
            modelId: normalized.id,
            modelType: normalized.modelType,
            ...scope,
            permissionId
          }
        },
        { upsert: true }
      );
    },
    async revokePermissionTo(model, permission, context) {
      const normalized = normalizeModel2(model);
      const scope = normalizeScope(options.scopeMode, context);
      const permissionDoc = await models.Permission.findOne({
        name: permission
      }).lean();
      if (!permissionDoc?._id) return;
      await models.ModelHasPermission.deleteMany({
        modelId: normalized.id,
        modelType: normalized.modelType,
        ...scope,
        permissionId: permissionDoc._id
      });
    },
    async syncPermissions(model, permissions, context) {
      const normalized = normalizeModel2(model);
      const scope = normalizeScope(options.scopeMode, context);
      const permissionDocs = await models.Permission.find({
        name: { $in: permissions }
      }).select({ _id: 1 }).lean();
      await models.ModelHasPermission.deleteMany({
        modelId: normalized.id,
        modelType: normalized.modelType,
        ...scope
      });
      if (permissionDocs.length === 0) return;
      await models.ModelHasPermission.insertMany(
        permissionDocs.map((permissionDoc) => ({
          modelId: normalized.id,
          modelType: normalized.modelType,
          ...scope,
          permissionId: permissionDoc._id
        }))
      );
    },
    async assignPermissionToRole(role, permission, context) {
      const scope = normalizeScope(options.scopeMode, context);
      const [roleId, permissionId] = await Promise.all([
        findRoleIdOrThrow(role, options),
        findPermissionIdOrThrow(permission, options)
      ]);
      await models.RoleHasPermission.updateOne(
        {
          roleId,
          permissionId,
          ...scope
        },
        {
          $setOnInsert: {
            roleId,
            permissionId,
            ...scope
          }
        },
        { upsert: true }
      );
    },
    async revokePermissionFromRole(role, permission, context) {
      const scope = normalizeScope(options.scopeMode, context);
      const [roleDoc, permissionDoc] = await Promise.all([
        models.Role.findOne({ name: role }).lean(),
        models.Permission.findOne({ name: permission }).lean()
      ]);
      if (!roleDoc?._id || !permissionDoc?._id) return;
      await models.RoleHasPermission.deleteMany({
        roleId: roleDoc._id,
        permissionId: permissionDoc._id,
        ...scope
      });
    },
    async syncRolePermissions(role, permissions, context) {
      const scope = normalizeScope(options.scopeMode, context);
      const [roleDoc, permissionDocs] = await Promise.all([
        models.Role.findOne({ name: role }).lean(),
        models.Permission.find({ name: { $in: permissions } }).select({ _id: 1 }).lean()
      ]);
      if (!roleDoc?._id) {
        throw new Error(`[permifyjs] role "${role}" not found`);
      }
      await models.RoleHasPermission.deleteMany({
        roleId: roleDoc._id,
        ...scope
      });
      if (permissionDocs.length === 0) return;
      await models.RoleHasPermission.insertMany(
        permissionDocs.map((permissionDoc) => ({
          roleId: roleDoc._id,
          permissionId: permissionDoc._id,
          ...scope
        }))
      );
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createMongooseResolver,
  createMongooseWriteResolver,
  registerPermifyModels
});

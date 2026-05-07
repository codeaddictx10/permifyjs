import type {
  AuthContext,
  AuthModel,
  PermissionWriteResolver,
} from '@permifyjs/core';
import {
  registerPermifyModels,
  type RegisterPermifyModelsOptions,
} from './models';
import { normalizeScope } from './scope';

export interface MongooseWriteResolverOptions extends RegisterPermifyModelsOptions { }

function normalizeModel(model: AuthModel): AuthModel {
  return {
    ...model,
    modelType: model.modelType ?? 'User',
  };
}

async function findRoleIdOrThrow(
  roleName: string,
  options: MongooseWriteResolverOptions,
  context?: AuthContext
) {
  const { Role } = registerPermifyModels(options);
  const scope = normalizeScope(options.scopeMode, context);

  const role = await Role.findOne({ name: roleName, ...scope }).lean();

  if (!role?._id) {
    throw new Error(`[permifyjs] role "${roleName}" not found`);
  }

  return role._id;
}

async function findPermissionIdOrThrow(
  permissionName: string,
  options: MongooseWriteResolverOptions
) {
  const { Permission } = registerPermifyModels(options);
  const permission = await Permission.findOne({ name: permissionName }).lean();

  if (!permission?._id) {
    throw new Error(`[permifyjs] permission "${permissionName}" not found`);
  }

  return permission._id;
}

export function createMongooseWriteResolver(
  options: MongooseWriteResolverOptions = {}
): PermissionWriteResolver {
  const models = registerPermifyModels(options);

  return {
    async assignRole(
      model: AuthModel,
      role: string,
      context?: AuthContext
    ): Promise<void> {
      const normalized = normalizeModel(model);
      const scope = normalizeScope(options.scopeMode, context);
      const roleId = await findRoleIdOrThrow(role, options, context);

      await models.ModelHasRole.updateOne(
        {
          modelId: normalized.id,
          modelType: normalized.modelType,
          ...scope,
          roleId,
        },
        {
          $setOnInsert: {
            modelId: normalized.id,
            modelType: normalized.modelType,
            ...scope,
            roleId,
          },
        },
        { upsert: true }
      );
    },

    async removeRole(
      model: AuthModel,
      role: string,
      context?: AuthContext
    ): Promise<void> {
      const normalized = normalizeModel(model);
      const scope = normalizeScope(options.scopeMode, context);
      const roleDoc = await models.Role.findOne({ name: role, ...scope }).lean();
      if (!roleDoc?._id) return;

      await models.ModelHasRole.deleteMany({
        modelId: normalized.id,
        modelType: normalized.modelType,
        ...scope,
        roleId: roleDoc._id,
      });
    },

    async syncRoles(
      model: AuthModel,
      roles: string[],
      context?: AuthContext
    ): Promise<void> {
      const normalized = normalizeModel(model);
      const scope = normalizeScope(options.scopeMode, context);
      const roleDocs = await models.Role.find({ name: { $in: roles }, ...scope })
        .select({ _id: 1 })
        .lean();

      await models.ModelHasRole.deleteMany({
        modelId: normalized.id,
        modelType: normalized.modelType,
        ...scope,
      });

      if (roleDocs.length === 0) return;

      await models.ModelHasRole.insertMany(
        roleDocs.map((roleDoc) => ({
          modelId: normalized.id,
          modelType: normalized.modelType,
          ...scope,
          roleId: roleDoc._id,
        }))
      );
    },

    async givePermissionTo(
      model: AuthModel,
      permission: string,
      context?: AuthContext
    ): Promise<void> {
      const normalized = normalizeModel(model);
      const scope = normalizeScope(options.scopeMode, context);
      const permissionId = await findPermissionIdOrThrow(permission, options);

      await models.ModelHasPermission.updateOne(
        {
          modelId: normalized.id,
          modelType: normalized.modelType,
          ...scope,
          permissionId,
        },
        {
          $setOnInsert: {
            modelId: normalized.id,
            modelType: normalized.modelType,
            ...scope,
            permissionId,
          },
        },
        { upsert: true }
      );
    },

    async revokePermissionTo(
      model: AuthModel,
      permission: string,
      context?: AuthContext
    ): Promise<void> {
      const normalized = normalizeModel(model);
      const scope = normalizeScope(options.scopeMode, context);
      const permissionDoc = await models.Permission.findOne({
        name: permission,
      }).lean();

      if (!permissionDoc?._id) return;

      await models.ModelHasPermission.deleteMany({
        modelId: normalized.id,
        modelType: normalized.modelType,
        ...scope,
        permissionId: permissionDoc._id,
      });
    },

    async syncPermissions(
      model: AuthModel,
      permissions: string[],
      context?: AuthContext
    ): Promise<void> {
      const normalized = normalizeModel(model);
      const scope = normalizeScope(options.scopeMode, context);
      const permissionDocs = await models.Permission.find({
        name: { $in: permissions },
      })
        .select({ _id: 1 })
        .lean();

      await models.ModelHasPermission.deleteMany({
        modelId: normalized.id,
        modelType: normalized.modelType,
        ...scope,
      });

      if (permissionDocs.length === 0) return;

      await models.ModelHasPermission.insertMany(
        permissionDocs.map((permissionDoc) => ({
          modelId: normalized.id,
          modelType: normalized.modelType,
          ...scope,
          permissionId: permissionDoc._id,
        }))
      );
    },

    async assignPermissionToRole(
      role: string,
      permission: string,
      context?: AuthContext
    ): Promise<void> {
      const scope = normalizeScope(options.scopeMode, context);
      const [roleId, permissionId] = await Promise.all([
        findRoleIdOrThrow(role, options, context),
        findPermissionIdOrThrow(permission, options),
      ]);

      await models.RoleHasPermission.updateOne(
        {
          roleId,
          permissionId,
          ...scope,
        },
        {
          $setOnInsert: {
            roleId,
            permissionId,
            ...scope,
          },
        },
        { upsert: true }
      );
    },

    async revokePermissionFromRole(
      role: string,
      permission: string,
      context?: AuthContext
    ): Promise<void> {
      const scope = normalizeScope(options.scopeMode, context);
      const [roleDoc, permissionDoc] = await Promise.all([
        models.Role.findOne({ name: role, ...scope }).lean(),
        models.Permission.findOne({ name: permission }).lean(),
      ]);

      if (!roleDoc?._id || !permissionDoc?._id) return;

      await models.RoleHasPermission.deleteMany({
        roleId: roleDoc._id,
        permissionId: permissionDoc._id,
        ...scope,
      });
    },

    async syncRolePermissions(
      role: string,
      permissions: string[],
      context?: AuthContext
    ): Promise<void> {
      const scope = normalizeScope(options.scopeMode, context);
      const [roleDoc, permissionDocs] = await Promise.all([
        models.Role.findOne({ name: role, ...scope }).lean(),
        models.Permission.find({ name: { $in: permissions } })
          .select({ _id: 1 })
          .lean(),
      ]);

      if (!roleDoc?._id) {
        throw new Error(`[permifyjs] role "${role}" not found`);
      }

      await models.RoleHasPermission.deleteMany({
        roleId: roleDoc._id,
        ...scope,
      });

      if (permissionDocs.length === 0) return;

      await models.RoleHasPermission.insertMany(
        permissionDocs.map((permissionDoc) => ({
          roleId: roleDoc._id,
          permissionId: permissionDoc._id,
          ...scope,
        }))
      );
    },
  };
}

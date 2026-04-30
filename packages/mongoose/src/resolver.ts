import type {
  AuthContext,
  AuthModel,
  PermissionResolver,
} from '@permifyjs/core';
import {
  registerPermifyModels,
  type RegisterPermifyModelsOptions,
} from './models';

export interface MongooseResolverOptions extends RegisterPermifyModelsOptions {}

function normalizeModel(model: AuthModel): AuthModel {
  return {
    ...model,
    modelType: model.modelType ?? 'User',
  };
}

export function createMongooseResolver(
  options: MongooseResolverOptions = {}
): PermissionResolver {
  const models = registerPermifyModels(options);

  return {
    async getRoles(model: AuthModel, _context?: AuthContext): Promise<string[]> {
      const normalized = normalizeModel(model);
      const assignments = await models.ModelHasRole.find({
        modelId: normalized.id,
        modelType: normalized.modelType,
      }).lean();

      if (assignments.length === 0) return [];

      const roleIds = assignments.map((assignment) => assignment.roleId);
      const roles = await models.Role.find({ _id: { $in: roleIds } })
        .select({ name: 1, _id: 0 })
        .lean();

      return roles.map((role) => role.name);
    },

    async getDirectPermissions(
      model: AuthModel,
      _context?: AuthContext
    ): Promise<string[]> {
      const normalized = normalizeModel(model);
      const assignments = await models.ModelHasPermission.find({
        modelId: normalized.id,
        modelType: normalized.modelType,
      }).lean();

      if (assignments.length === 0) return [];

      const permissionIds = assignments.map((assignment) => assignment.permissionId);
      const permissions = await models.Permission.find({
        _id: { $in: permissionIds },
      })
        .select({ name: 1, _id: 0 })
        .lean();

      return permissions.map((permission) => permission.name);
    },

    async getPermissionsThroughRoles(
      model: AuthModel,
      _context?: AuthContext
    ): Promise<string[]> {
      const normalized = normalizeModel(model);
      const assignments = await models.ModelHasRole.find({
        modelId: normalized.id,
        modelType: normalized.modelType,
      }).lean();

      if (assignments.length === 0) return [];

      const roleIds = assignments.map((assignment) => assignment.roleId);
      const rolePermissionLinks = await models.RoleHasPermission.find({
        roleId: { $in: roleIds },
      }).lean();

      if (rolePermissionLinks.length === 0) return [];

      const permissionIds = rolePermissionLinks.map((link) => link.permissionId);
      const permissions = await models.Permission.find({
        _id: { $in: permissionIds },
      })
        .select({ name: 1, _id: 0 })
        .lean();

      return [...new Set(permissions.map((permission) => permission.name))];
    },

    async getRolePermissions(
      role: string,
      _context?: AuthContext
    ): Promise<string[]> {
      const roleDoc = await models.Role.findOne({ name: role }).lean();
      if (!roleDoc?._id) return [];

      const links = await models.RoleHasPermission.find({
        roleId: roleDoc._id,
      }).lean();

      if (links.length === 0) return [];

      const permissionIds = links.map((link) => link.permissionId);
      const permissions = await models.Permission.find({
        _id: { $in: permissionIds },
      })
        .select({ name: 1, _id: 0 })
        .lean();

      return permissions.map((permission) => permission.name);
    },
  };
}

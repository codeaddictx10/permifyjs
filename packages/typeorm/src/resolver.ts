import type {
  AuthContext,
  AuthModel,
  PermissionResolver,
} from '@permifyjs/core';
import type { DataSource, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { normalizeScope, type ScopeRecord, type ScopeMode } from './scope';
import { getPermifyTableNames, type PermifyTableNames } from './schema';

export interface TypeOrmResolverOptions {
  tableNames?: PermifyTableNames;
  scopeMode?: ScopeMode;
}

function normalizeModel(model: AuthModel): AuthModel {
  return {
    ...model,
    modelType: model.modelType ?? 'User',
  };
}

function applyScopeWhere<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  scope: ScopeRecord,
  prefix: string
): void {
  for (const [field, value] of Object.entries(scope)) {
    qb.andWhere(`${alias}.${field} = :${prefix}${field}`, {
      [`${prefix}${field}`]: value,
    });
  }
}

async function findRoleIdByName(
  dataSource: DataSource,
  roleName: string,
  options: TypeOrmResolverOptions,
  context?: AuthContext
): Promise<string | null> {
  const tableNames = getPermifyTableNames(options.tableNames);
  const scope = normalizeScope(options.scopeMode, context);
  const qb = dataSource
    .createQueryBuilder()
    .select('role.id', 'id')
    .from(tableNames.roles, 'role')
    .where('role.name = :name', { name: roleName });

  applyScopeWhere(qb, 'role', scope, 'roleScope_');

  const row = await qb.getRawOne<{ id: string }>();

  return row?.id ?? null;
}

export function createTypeOrmResolver(
  dataSource: DataSource,
  options: TypeOrmResolverOptions = {}
): PermissionResolver {
  const tableNames = getPermifyTableNames(options.tableNames);

  return {
    async getRoles(model: AuthModel, context?: AuthContext): Promise<string[]> {
      const normalized = normalizeModel(model);
      const scope = normalizeScope(options.scopeMode, context);
      const qb = dataSource
        .createQueryBuilder()
        .select('role.name', 'name')
        .from(tableNames.modelHasRoles, 'assignment')
        .innerJoin(
          tableNames.roles,
          'role',
          'role.id = assignment.roleId'
        )
        .where('assignment.modelId = :modelId', { modelId: normalized.id })
        .andWhere('assignment.modelType = :modelType', {
          modelType: normalized.modelType,
        })
        .orderBy('role.name', 'ASC');

      applyScopeWhere(qb, 'assignment', scope, 'assignmentScope_');

      const rows = await qb.getRawMany<{ name: string }>();
      return rows.map((row) => row.name);
    },

    async getDirectPermissions(
      model: AuthModel,
      context?: AuthContext
    ): Promise<string[]> {
      const normalized = normalizeModel(model);
      const scope = normalizeScope(options.scopeMode, context);
      const qb = dataSource
        .createQueryBuilder()
        .select('permission.name', 'name')
        .from(tableNames.modelHasPermissions, 'assignment')
        .innerJoin(
          tableNames.permissions,
          'permission',
          'permission.id = assignment.permissionId'
        )
        .where('assignment.modelId = :modelId', { modelId: normalized.id })
        .andWhere('assignment.modelType = :modelType', {
          modelType: normalized.modelType,
        })
        .orderBy('permission.name', 'ASC');

      applyScopeWhere(qb, 'assignment', scope, 'assignmentScope_');

      const rows = await qb.getRawMany<{ name: string }>();
      return rows.map((row) => row.name);
    },

    async getPermissionsThroughRoles(
      model: AuthModel,
      context?: AuthContext
    ): Promise<string[]> {
      const normalized = normalizeModel(model);
      const scope = normalizeScope(options.scopeMode, context);
      const qb = dataSource
        .createQueryBuilder()
        .select('permission.name', 'name')
        .from(tableNames.modelHasRoles, 'assignment')
        .innerJoin(
          tableNames.roleHasPermissions,
          'link',
          'link.roleId = assignment.roleId'
        )
        .innerJoin(
          tableNames.permissions,
          'permission',
          'permission.id = link.permissionId'
        )
        .where('assignment.modelId = :modelId', { modelId: normalized.id })
        .andWhere('assignment.modelType = :modelType', {
          modelType: normalized.modelType,
        })
        .orderBy('permission.name', 'ASC');

      applyScopeWhere(qb, 'assignment', scope, 'assignmentScope_');
      applyScopeWhere(qb, 'link', scope, 'linkScope_');

      const rows = await qb.getRawMany<{ name: string }>();
      return [...new Set(rows.map((row) => row.name))];
    },

    async getRolePermissions(
      role: string,
      context?: AuthContext
    ): Promise<string[]> {
      const roleId = await findRoleIdByName(dataSource, role, options, context);
      if (!roleId) return [];

      const scope = normalizeScope(options.scopeMode, context);
      const qb = dataSource
        .createQueryBuilder()
        .select('permission.name', 'name')
        .from(tableNames.roleHasPermissions, 'link')
        .innerJoin(
          tableNames.permissions,
          'permission',
          'permission.id = link.permissionId'
        )
        .where('link.roleId = :roleId', { roleId })
        .orderBy('permission.name', 'ASC');

      applyScopeWhere(qb, 'link', scope, 'linkScope_');

      const rows = await qb.getRawMany<{ name: string }>();
      return rows.map((row) => row.name);
    },
  };
}

import { randomUUID } from 'node:crypto';
import type {
  AuthContext,
  AuthModel,
  PermissionWriteResolver,
} from '@permifyjs/core';
import type { DataSource } from 'typeorm';
import { normalizeScope, type ScopeMode } from './scope';
import { getPermifyTableNames, type PermifyTableNames } from './schema';

export interface TypeOrmWriteResolverOptions {
  tableNames?: PermifyTableNames;
  scopeMode?: ScopeMode;
}

function normalizeModel(model: AuthModel): AuthModel {
  return {
    ...model,
    modelType: model.modelType ?? 'User',
  };
}

async function findIdByNameOrThrow(
  dataSource: DataSource,
  tableName: string,
  value: string,
  label: 'role' | 'permission',
  scope?: Record<string, string>
): Promise<string> {
  const qb = dataSource
    .createQueryBuilder()
    .select('record.id', 'id')
    .from(tableName, 'record')
    .where('record.name = :name', { name: value });

  for (const [field, fieldValue] of Object.entries(scope ?? {})) {
    qb.andWhere(`record.${field} = :${field}`, { [field]: fieldValue });
  }

  const row = await qb.getRawOne<{ id: string }>();

  if (!row?.id) {
    throw new Error(`[permifyjs] ${label} "${value}" not found`);
  }

  return row.id;
}

async function findIdByName(
  dataSource: DataSource,
  tableName: string,
  value: string,
  scope?: Record<string, string>
): Promise<string | null> {
  const qb = dataSource
    .createQueryBuilder()
    .select('record.id', 'id')
    .from(tableName, 'record')
    .where('record.name = :name', { name: value });

  for (const [field, fieldValue] of Object.entries(scope ?? {})) {
    qb.andWhere(`record.${field} = :${field}`, { [field]: fieldValue });
  }

  const row = await qb.getRawOne<{ id: string }>();

  return row?.id ?? null;
}

export function createTypeOrmWriteResolver(
  dataSource: DataSource,
  options: TypeOrmWriteResolverOptions = {}
): PermissionWriteResolver {
  const tableNames = getPermifyTableNames(options.tableNames);

  return {
    async assignRole(
      model: AuthModel,
      role: string,
      context?: AuthContext
    ): Promise<void> {
      const normalized = normalizeModel(model);
      const scope = normalizeScope(options.scopeMode, context);
      const roleId = await findIdByNameOrThrow(
        dataSource,
        tableNames.roles,
        role,
        'role',
        scope
      );

      await dataSource
        .createQueryBuilder()
        .insert()
        .into(tableNames.modelHasRoles)
        .values({
          modelId: normalized.id,
          modelType: normalized.modelType,
          roleId,
          ...scope,
        })
        .orIgnore()
        .execute();
    },

    async removeRole(
      model: AuthModel,
      role: string,
      context?: AuthContext
    ): Promise<void> {
      const normalized = normalizeModel(model);
      const scope = normalizeScope(options.scopeMode, context);
      const roleId = await findIdByName(dataSource, tableNames.roles, role, scope);
      if (!roleId) return;

      const deleteQuery = dataSource
        .createQueryBuilder()
        .delete()
        .from(tableNames.modelHasRoles)
        .where('modelId = :modelId', { modelId: normalized.id })
        .andWhere('modelType = :modelType', { modelType: normalized.modelType })
        .andWhere('roleId = :roleId', { roleId });

      for (const [field, value] of Object.entries(scope)) {
        deleteQuery.andWhere(`${field} = :${field}`, { [field]: value });
      }

      await deleteQuery.execute();
    },

    async syncRoles(
      model: AuthModel,
      roles: string[],
      context?: AuthContext
    ): Promise<void> {
      const normalized = normalizeModel(model);
      const scope = normalizeScope(options.scopeMode, context);

      const deleteQuery = dataSource
        .createQueryBuilder()
        .delete()
        .from(tableNames.modelHasRoles)
        .where('modelId = :modelId', { modelId: normalized.id })
        .andWhere('modelType = :modelType', { modelType: normalized.modelType });

      for (const [field, value] of Object.entries(scope)) {
        deleteQuery.andWhere(`${field} = :${field}`, { [field]: value });
      }

      await deleteQuery.execute();

      if (roles.length === 0) return;

      const roleQuery = dataSource
        .createQueryBuilder()
        .select('role.id', 'id')
        .from(tableNames.roles, 'role')
        .where('role.name IN (:...names)', { names: roles });

      for (const [field, value] of Object.entries(scope)) {
        roleQuery.andWhere(`role.${field} = :${field}`, { [field]: value });
      }

      const roleRows = await roleQuery.getRawMany<{ id: string }>();

      if (roleRows.length === 0) return;

      await dataSource
        .createQueryBuilder()
        .insert()
        .into(tableNames.modelHasRoles)
        .values(
          roleRows.map((row) => ({
            modelId: normalized.id,
            modelType: normalized.modelType,
            roleId: row.id,
            ...scope,
          }))
        )
        .orIgnore()
        .execute();
    },

    async givePermissionTo(
      model: AuthModel,
      permission: string,
      context?: AuthContext
    ): Promise<void> {
      const normalized = normalizeModel(model);
      const permissionId = await findIdByNameOrThrow(
        dataSource,
        tableNames.permissions,
        permission,
        'permission'
      );
      const scope = normalizeScope(options.scopeMode, context);

      await dataSource
        .createQueryBuilder()
        .insert()
        .into(tableNames.modelHasPermissions)
        .values({
          modelId: normalized.id,
          modelType: normalized.modelType,
          permissionId,
          ...scope,
        })
        .orIgnore()
        .execute();
    },

    async revokePermissionTo(
      model: AuthModel,
      permission: string,
      context?: AuthContext
    ): Promise<void> {
      const normalized = normalizeModel(model);
      const permissionId = await findIdByName(
        dataSource,
        tableNames.permissions,
        permission
      );
      if (!permissionId) return;

      const scope = normalizeScope(options.scopeMode, context);
      const deleteQuery = dataSource
        .createQueryBuilder()
        .delete()
        .from(tableNames.modelHasPermissions)
        .where('modelId = :modelId', { modelId: normalized.id })
        .andWhere('modelType = :modelType', { modelType: normalized.modelType })
        .andWhere('permissionId = :permissionId', { permissionId });

      for (const [field, value] of Object.entries(scope)) {
        deleteQuery.andWhere(`${field} = :${field}`, { [field]: value });
      }

      await deleteQuery.execute();
    },

    async syncPermissions(
      model: AuthModel,
      permissions: string[],
      context?: AuthContext
    ): Promise<void> {
      const normalized = normalizeModel(model);
      const scope = normalizeScope(options.scopeMode, context);

      const deleteQuery = dataSource
        .createQueryBuilder()
        .delete()
        .from(tableNames.modelHasPermissions)
        .where('modelId = :modelId', { modelId: normalized.id })
        .andWhere('modelType = :modelType', { modelType: normalized.modelType });

      for (const [field, value] of Object.entries(scope)) {
        deleteQuery.andWhere(`${field} = :${field}`, { [field]: value });
      }

      await deleteQuery.execute();

      if (permissions.length === 0) return;

      const permissionRows = await dataSource
        .createQueryBuilder()
        .select('permission.id', 'id')
        .from(tableNames.permissions, 'permission')
        .where('permission.name IN (:...names)', { names: permissions })
        .getRawMany<{ id: string }>();

      if (permissionRows.length === 0) return;

      await dataSource
        .createQueryBuilder()
        .insert()
        .into(tableNames.modelHasPermissions)
        .values(
          permissionRows.map((row) => ({
            modelId: normalized.id,
            modelType: normalized.modelType,
            permissionId: row.id,
            ...scope,
          }))
        )
        .orIgnore()
        .execute();
    },

    async assignPermissionToRole(
      role: string,
      permission: string,
      context?: AuthContext
    ): Promise<void> {
      const scope = normalizeScope(options.scopeMode, context);
      const [roleId, permissionId] = await Promise.all([
        findIdByNameOrThrow(dataSource, tableNames.roles, role, 'role', scope),
        findIdByNameOrThrow(
          dataSource,
          tableNames.permissions,
          permission,
          'permission'
        ),
      ]);

      await dataSource
        .createQueryBuilder()
        .insert()
        .into(tableNames.roleHasPermissions)
        .values({
          roleId,
          permissionId,
          ...scope,
        })
        .orIgnore()
        .execute();
    },

    async revokePermissionFromRole(
      role: string,
      permission: string,
      context?: AuthContext
    ): Promise<void> {
      const scope = normalizeScope(options.scopeMode, context);
      const [roleId, permissionId] = await Promise.all([
        findIdByName(dataSource, tableNames.roles, role, scope),
        findIdByName(dataSource, tableNames.permissions, permission),
      ]);

      if (!roleId || !permissionId) return;
      const deleteQuery = dataSource
        .createQueryBuilder()
        .delete()
        .from(tableNames.roleHasPermissions)
        .where('roleId = :roleId', { roleId })
        .andWhere('permissionId = :permissionId', { permissionId });

      for (const [field, value] of Object.entries(scope)) {
        deleteQuery.andWhere(`${field} = :${field}`, { [field]: value });
      }

      await deleteQuery.execute();
    },

    async syncRolePermissions(
      role: string,
      permissions: string[],
      context?: AuthContext
    ): Promise<void> {
      const scope = normalizeScope(options.scopeMode, context);
      const roleId = await findIdByNameOrThrow(
        dataSource,
        tableNames.roles,
        role,
        'role',
        scope
      );
      const deleteQuery = dataSource
        .createQueryBuilder()
        .delete()
        .from(tableNames.roleHasPermissions)
        .where('roleId = :roleId', { roleId });

      for (const [field, value] of Object.entries(scope)) {
        deleteQuery.andWhere(`${field} = :${field}`, { [field]: value });
      }

      await deleteQuery.execute();

      if (permissions.length === 0) return;

      const permissionRows = await dataSource
        .createQueryBuilder()
        .select('permission.id', 'id')
        .from(tableNames.permissions, 'permission')
        .where('permission.name IN (:...names)', { names: permissions })
        .getRawMany<{ id: string }>();

      if (permissionRows.length === 0) return;

      await dataSource
        .createQueryBuilder()
        .insert()
        .into(tableNames.roleHasPermissions)
        .values(
          permissionRows.map((row) => ({
            roleId,
            permissionId: row.id,
            ...scope,
          }))
        )
        .orIgnore()
        .execute();
    },
  };
}

export async function createPermifyRecord(
  dataSource: DataSource,
  tableName: string,
  name: string
): Promise<'created' | 'exists'> {
  const existingId = await findIdByName(dataSource, tableName, name);
  if (existingId) return 'exists';

  await dataSource
    .createQueryBuilder()
    .insert()
    .into(tableName)
    .values({
      id: randomUUID(),
      name,
    })
    .execute();

  return 'created';
}

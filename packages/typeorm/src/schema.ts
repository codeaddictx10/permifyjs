import type { DataSource } from 'typeorm';
import { Table, type TableColumnOptions, type TableUniqueOptions } from 'typeorm';
import { GLOBAL_SCOPE, getEnabledScopeFields, type ScopeMode } from './scope';

export interface PermifyTableNames {
  roles?: string;
  permissions?: string;
  roleHasPermissions?: string;
  modelHasRoles?: string;
  modelHasPermissions?: string;
}

export interface TypeOrmSchemaOptions {
  tableNames?: PermifyTableNames;
  scopeMode?: ScopeMode;
}

export interface PermifySchemaStatus {
  allPresent: boolean;
  tables: Record<keyof Required<PermifyTableNames>, boolean>;
}

const DEFAULT_TABLE_NAMES = {
  roles: 'roles',
  permissions: 'permissions',
  roleHasPermissions: 'role_has_permissions',
  modelHasRoles: 'model_has_roles',
  modelHasPermissions: 'model_has_permissions',
} as const;

type ResolvedTableNames = Required<PermifyTableNames>;

function getTimestampColumnType(dataSource: DataSource): string {
  const type = dataSource.options.type;

  switch (type) {
    case 'postgres':
    case 'cockroachdb':
      return 'timestamp';
    default:
      return 'datetime';
  }
}

function getScopeColumns(scopeMode?: ScopeMode): TableColumnOptions[] {
  return getEnabledScopeFields(scopeMode).map((field) => ({
    name: field,
    type: 'varchar',
    isNullable: false,
    default: `'${GLOBAL_SCOPE}'`,
  }));
}

function createCompositeUnique(
  name: string,
  columnNames: string[]
): TableUniqueOptions {
  return {
    name,
    columnNames,
  };
}

function createRolesTable(
  dataSource: DataSource,
  tableNames: ResolvedTableNames,
  scopeMode?: ScopeMode
): Table {
  const timestampType = getTimestampColumnType(dataSource);
  const scopeColumns = getEnabledScopeFields(scopeMode);

  return new Table({
    name: tableNames.roles,
    columns: [
      {
        name: 'id',
        type: 'varchar',
        isPrimary: true,
      },
      {
        name: 'name',
        type: 'varchar',
        isNullable: false,
      },
      ...getScopeColumns(scopeMode),
      {
        name: 'createdAt',
        type: timestampType,
        isNullable: false,
        default: 'CURRENT_TIMESTAMP',
      },
      {
        name: 'updatedAt',
        type: timestampType,
        isNullable: false,
        default: 'CURRENT_TIMESTAMP',
      },
    ],
    uniques: [
      createCompositeUnique('permify_roles_name_unique', ['name', ...scopeColumns]),
    ],
  });
}

function createPermissionsTable(
  dataSource: DataSource,
  tableNames: ResolvedTableNames
): Table {
  const timestampType = getTimestampColumnType(dataSource);

  return new Table({
    name: tableNames.permissions,
    columns: [
      {
        name: 'id',
        type: 'varchar',
        isPrimary: true,
      },
      {
        name: 'name',
        type: 'varchar',
        isNullable: false,
      },
      {
        name: 'createdAt',
        type: timestampType,
        isNullable: false,
        default: 'CURRENT_TIMESTAMP',
      },
      {
        name: 'updatedAt',
        type: timestampType,
        isNullable: false,
        default: 'CURRENT_TIMESTAMP',
      },
    ],
    uniques: [
      createCompositeUnique('permify_permissions_name_unique', ['name']),
    ],
  });
}

function createRoleHasPermissionsTable(
  tableNames: ResolvedTableNames,
  scopeMode?: ScopeMode
): Table {
  const scopeColumns = getEnabledScopeFields(scopeMode);

  return new Table({
    name: tableNames.roleHasPermissions,
    columns: [
      {
        name: 'roleId',
        type: 'varchar',
        isNullable: false,
      },
      {
        name: 'permissionId',
        type: 'varchar',
        isNullable: false,
      },
      ...getScopeColumns(scopeMode),
    ],
    uniques: [
      createCompositeUnique('permify_role_has_permissions_unique', [
        'roleId',
        'permissionId',
        ...scopeColumns,
      ]),
    ],
    foreignKeys: [
      {
        columnNames: ['roleId'],
        referencedTableName: tableNames.roles,
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      },
      {
        columnNames: ['permissionId'],
        referencedTableName: tableNames.permissions,
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      },
    ],
  });
}

function createModelHasRolesTable(
  tableNames: ResolvedTableNames,
  scopeMode?: ScopeMode
): Table {
  const scopeColumns = getEnabledScopeFields(scopeMode);

  return new Table({
    name: tableNames.modelHasRoles,
    columns: [
      {
        name: 'modelId',
        type: 'varchar',
        isNullable: false,
      },
      {
        name: 'modelType',
        type: 'varchar',
        isNullable: false,
      },
      ...getScopeColumns(scopeMode),
      {
        name: 'roleId',
        type: 'varchar',
        isNullable: false,
      },
    ],
    uniques: [
      createCompositeUnique('permify_model_has_roles_unique', [
        'modelId',
        'modelType',
        ...scopeColumns,
        'roleId',
      ]),
    ],
    foreignKeys: [
      {
        columnNames: ['roleId'],
        referencedTableName: tableNames.roles,
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      },
    ],
  });
}

function createModelHasPermissionsTable(
  tableNames: ResolvedTableNames,
  scopeMode?: ScopeMode
): Table {
  const scopeColumns = getEnabledScopeFields(scopeMode);

  return new Table({
    name: tableNames.modelHasPermissions,
    columns: [
      {
        name: 'modelId',
        type: 'varchar',
        isNullable: false,
      },
      {
        name: 'modelType',
        type: 'varchar',
        isNullable: false,
      },
      ...getScopeColumns(scopeMode),
      {
        name: 'permissionId',
        type: 'varchar',
        isNullable: false,
      },
    ],
    uniques: [
      createCompositeUnique('permify_model_has_permissions_unique', [
        'modelId',
        'modelType',
        ...scopeColumns,
        'permissionId',
      ]),
    ],
    foreignKeys: [
      {
        columnNames: ['permissionId'],
        referencedTableName: tableNames.permissions,
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      },
    ],
  });
}

export function getPermifyTableNames(
  tableNames?: PermifyTableNames
): ResolvedTableNames {
  return {
    ...DEFAULT_TABLE_NAMES,
    ...tableNames,
  };
}

export async function getPermifySchemaStatus(
  dataSource: DataSource,
  options: TypeOrmSchemaOptions = {}
): Promise<PermifySchemaStatus> {
  const tableNames = getPermifyTableNames(options.tableNames);
  const queryRunner = dataSource.createQueryRunner();

  try {
    const tables = {
      roles: await queryRunner.hasTable(tableNames.roles),
      permissions: await queryRunner.hasTable(tableNames.permissions),
      roleHasPermissions: await queryRunner.hasTable(tableNames.roleHasPermissions),
      modelHasRoles: await queryRunner.hasTable(tableNames.modelHasRoles),
      modelHasPermissions: await queryRunner.hasTable(tableNames.modelHasPermissions),
    };

    return {
      allPresent: Object.values(tables).every(Boolean),
      tables,
    };
  } finally {
    await queryRunner.release();
  }
}

export async function syncPermifySchema(
  dataSource: DataSource,
  options: TypeOrmSchemaOptions = {}
): Promise<void> {
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

export async function dropPermifySchema(
  dataSource: DataSource,
  options: TypeOrmSchemaOptions = {}
): Promise<void> {
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

import { readFileSync } from 'fs';
import {
  findProjectPermifyModule,
  loadProjectConfig,
  loadProjectModule,
  loadProjectPackage,
  resolveProjectRelativeModule,
} from './project';
import type { AuthContext, ScopeMode } from '../../types';

type AuthModelLike = {
  id: string;
  modelType?: string;
};

type TableNames = {
  roles?: string;
  permissions?: string;
  roleHasPermissions?: string;
  modelHasRoles?: string;
  modelHasPermissions?: string;
};

type TypeOrmDataSourceLike = {
  isInitialized?: boolean;
  initialize?: () => Promise<unknown>;
  destroy?: () => Promise<void>;
  createQueryBuilder(): any;
  createQueryRunner(): any;
};

type TypeOrmResolverFactory = (
  dataSource: TypeOrmDataSourceLike,
  options?: {
    tableNames?: TableNames;
    scopeMode?: ScopeMode;
  }
) => {
  getRoles(model: AuthModelLike, context?: AuthContext): Promise<string[]>;
  getDirectPermissions(model: AuthModelLike, context?: AuthContext): Promise<string[]>;
  getPermissionsThroughRoles(model: AuthModelLike, context?: AuthContext): Promise<string[]>;
  getRolePermissions(role: string, context?: AuthContext): Promise<string[]>;
};

type TypeOrmWriteResolverFactory = (
  dataSource: TypeOrmDataSourceLike,
  options?: {
    tableNames?: TableNames;
    scopeMode?: ScopeMode;
  }
) => {
  assignRole(model: AuthModelLike, role: string, context?: AuthContext): Promise<void>;
  removeRole(model: AuthModelLike, role: string, context?: AuthContext): Promise<void>;
  assignPermissionToRole(
    role: string,
    permission: string,
    context?: AuthContext
  ): Promise<void>;
};

function findImportedBinding(
  source: string,
  identifier: string
): { specifier: string; exportName: 'default' | string } | null {
  const defaultImportPattern = new RegExp(
    String.raw`import\s+${identifier}\s*(?:,\s*\{[^}]*\})?\s*from\s*['"]([^'"]+)['"]`
  );
  const defaultMatch = source.match(defaultImportPattern);

  if (defaultMatch) {
    return { specifier: defaultMatch[1], exportName: 'default' };
  }

  const namedImports = source.matchAll(
    /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g
  );

  for (const match of namedImports) {
    const bindings = match[1].split(',').map((binding) => binding.trim());

    for (const binding of bindings) {
      if (binding === identifier) {
        return { specifier: match[2], exportName: identifier };
      }

      const aliasMatch = binding.match(
        /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/
      );
      if (aliasMatch && aliasMatch[2] === identifier) {
        return { specifier: match[2], exportName: aliasMatch[1] };
      }
    }
  }

  return null;
}

export async function loadTypeOrmRuntime(
  cwd = process.cwd()
): Promise<{
  dataSource: TypeOrmDataSourceLike;
  createPermifyRecord: (
    dataSource: TypeOrmDataSourceLike,
    tableName: string,
    name: string
  ) => Promise<'created' | 'exists'>;
  createTypeOrmResolver: TypeOrmResolverFactory;
  createTypeOrmWriteResolver: TypeOrmWriteResolverFactory;
  getPermifySchemaStatus: (
    dataSource: TypeOrmDataSourceLike,
    options?: { tableNames?: TableNames; scopeMode?: ScopeMode }
  ) => Promise<unknown>;
  syncPermifySchema: (
    dataSource: TypeOrmDataSourceLike,
    options?: { tableNames?: TableNames; scopeMode?: ScopeMode }
  ) => Promise<void>;
  dropPermifySchema: (
    dataSource: TypeOrmDataSourceLike,
    options?: { tableNames?: TableNames; scopeMode?: ScopeMode }
  ) => Promise<void>;
  getPermifyTableNames: (tableNames?: TableNames) => Required<TableNames>;
  tableNames?: TableNames;
  scopeMode?: ScopeMode;
  initializedHere: boolean;
} | null> {
  const writeResolverPath = findProjectPermifyModule('writeResolver', cwd);
  if (!writeResolverPath) return null;

  const writeResolverSource = readFileSync(writeResolverPath, 'utf-8');
  if (!writeResolverSource.includes('createTypeOrmWriteResolver')) {
    return null;
  }

  const argumentMatch = writeResolverSource.match(
    /createTypeOrmWriteResolver\(\s*([A-Za-z_$][\w$]*)\b/
  );
  if (!argumentMatch) return null;

  const importedBinding = findImportedBinding(writeResolverSource, argumentMatch[1]);
  if (!importedBinding) return null;

  const dataSourceModulePath = resolveProjectRelativeModule(
    writeResolverPath,
    importedBinding.specifier
  );
  if (!dataSourceModulePath) {
    throw new Error(
      `[permifyjs] Could not resolve TypeORM dataSource module "${importedBinding.specifier}" from ${writeResolverPath}`
    );
  }

  const dataSourceModule = loadProjectModule<Record<string, unknown>>(
    dataSourceModulePath,
    cwd
  );
  const dataSource =
    importedBinding.exportName === 'default'
      ? dataSourceModule.default
      : dataSourceModule[importedBinding.exportName];

  if (!dataSource || typeof dataSource !== 'object') {
    throw new Error(
      `[permifyjs] Failed to load TypeORM dataSource from ${dataSourceModulePath}`
    );
  }

  const typeormPackage = loadProjectPackage<{
    createPermifyRecord?: (
      dataSource: TypeOrmDataSourceLike,
      tableName: string,
      name: string
    ) => Promise<'created' | 'exists'>;
    createTypeOrmResolver?: TypeOrmResolverFactory;
    createTypeOrmWriteResolver?: TypeOrmWriteResolverFactory;
    getPermifySchemaStatus?: (
      dataSource: TypeOrmDataSourceLike,
      options?: { tableNames?: TableNames; scopeMode?: ScopeMode }
    ) => Promise<unknown>;
    syncPermifySchema?: (
      dataSource: TypeOrmDataSourceLike,
      options?: { tableNames?: TableNames; scopeMode?: ScopeMode }
    ) => Promise<void>;
    dropPermifySchema?: (
      dataSource: TypeOrmDataSourceLike,
      options?: { tableNames?: TableNames; scopeMode?: ScopeMode }
    ) => Promise<void>;
    getPermifyTableNames?: (tableNames?: TableNames) => Required<TableNames>;
  }>('@permifyjs/typeorm', cwd);

  if (
    typeof typeormPackage.createPermifyRecord !== 'function' ||
    typeof typeormPackage.createTypeOrmResolver !== 'function' ||
    typeof typeormPackage.createTypeOrmWriteResolver !== 'function' ||
    typeof typeormPackage.getPermifySchemaStatus !== 'function' ||
    typeof typeormPackage.syncPermifySchema !== 'function' ||
    typeof typeormPackage.dropPermifySchema !== 'function' ||
    typeof typeormPackage.getPermifyTableNames !== 'function'
  ) {
    throw new Error(
      '[permifyjs] @permifyjs/typeorm is installed but its runtime helpers could not be loaded'
    );
  }

  let initializedHere = false;
  if (!(dataSource as any).isInitialized) {
    await (dataSource as any).initialize?.();
    initializedHere = true;
  }

  const config = loadProjectConfig<{
    tables?: TableNames;
    scopeMode?: ScopeMode;
  }>(cwd);

  return {
    dataSource: dataSource as TypeOrmDataSourceLike,
    createPermifyRecord: typeormPackage.createPermifyRecord,
    createTypeOrmResolver: typeormPackage.createTypeOrmResolver,
    createTypeOrmWriteResolver: typeormPackage.createTypeOrmWriteResolver,
    getPermifySchemaStatus: typeormPackage.getPermifySchemaStatus,
    syncPermifySchema: typeormPackage.syncPermifySchema,
    dropPermifySchema: typeormPackage.dropPermifySchema,
    getPermifyTableNames: typeormPackage.getPermifyTableNames,
    tableNames: config?.tables,
    scopeMode: config?.scopeMode,
    initializedHere,
  };
}

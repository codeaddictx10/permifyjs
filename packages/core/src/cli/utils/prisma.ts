import { readFileSync } from 'fs';
import { findProjectPermifyModule, loadProjectConfig, loadProjectModule, loadProjectPackage, resolveProjectRelativeModule } from './project';
import type { AuthContext, ScopeMode } from '../../types';

type PrismaClientLike = {
  permifyRole?: {
    findUnique(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<Array<{ name: string }>>;
    create(args: unknown): Promise<unknown>;
  };
  permifyPermission?: {
    findUnique(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<Array<{ name: string }>>;
    create(args: unknown): Promise<unknown>;
  };
  $disconnect?: () => Promise<void>;
};

type AuthModelLike = {
  id: string;
  modelType?: string;
};

type PrismaResolverFactory = (
  prisma: PrismaClientLike,
  options?: { scopeMode?: ScopeMode }
) => {
  getRoles(model: AuthModelLike, context?: AuthContext): Promise<string[]>;
  getDirectPermissions(model: AuthModelLike, context?: AuthContext): Promise<string[]>;
  getPermissionsThroughRoles(model: AuthModelLike, context?: AuthContext): Promise<string[]>;
};

type PrismaWriteResolverFactory = (
  prisma: PrismaClientLike,
  options?: { scopeMode?: ScopeMode }
) => {
  assignRole(
    model: AuthModelLike,
    role: string,
    context?: AuthContext
  ): Promise<void>;
  removeRole(
    model: AuthModelLike,
    role: string,
    context?: AuthContext
  ): Promise<void>;
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

export async function loadPrismaRuntime(
  cwd = process.cwd()
): Promise<{
  prisma: PrismaClientLike;
  createPrismaResolver: PrismaResolverFactory;
  createPrismaWriteResolver: PrismaWriteResolverFactory;
  scopeMode?: ScopeMode;
} | null> {
  const writeResolverPath = findProjectPermifyModule('writeResolver', cwd);
  if (!writeResolverPath) return null;

  const writeResolverSource = readFileSync(writeResolverPath, 'utf-8');
  if (!writeResolverSource.includes('createPrismaWriteResolver')) {
    return null;
  }

  const argumentMatch = writeResolverSource.match(
    /createPrismaWriteResolver\(\s*([A-Za-z_$][\w$]*)\b/
  );
  if (!argumentMatch) return null;

  const importedBinding = findImportedBinding(writeResolverSource, argumentMatch[1]);
  if (!importedBinding) return null;

  const dbModulePath = resolveProjectRelativeModule(
    writeResolverPath,
    importedBinding.specifier
  );
  if (!dbModulePath) {
    throw new Error(
      `[permifyjs] Could not resolve Prisma client module "${importedBinding.specifier}" from ${writeResolverPath}`
    );
  }

  const dbModule = loadProjectModule<Record<string, unknown>>(dbModulePath, cwd);
  const prisma =
    importedBinding.exportName === 'default'
      ? dbModule.default
      : dbModule[importedBinding.exportName];

  if (!prisma || typeof prisma !== 'object') {
    throw new Error(
      `[permifyjs] Failed to load Prisma client from ${dbModulePath}`
    );
  }

  const prismaPackage = loadProjectPackage<{
    createPrismaResolver?: PrismaResolverFactory;
    createPrismaWriteResolver?: PrismaWriteResolverFactory;
  }>('@permifyjs/prisma', cwd);
  const config = loadProjectConfig<{ scopeMode?: ScopeMode }>(cwd);

  if (typeof prismaPackage.createPrismaResolver !== 'function') {
    throw new Error(
      '[permifyjs] @permifyjs/prisma is installed but createPrismaResolver could not be loaded'
    );
  }

  if (typeof prismaPackage.createPrismaWriteResolver !== 'function') {
    throw new Error(
      '[permifyjs] @permifyjs/prisma is installed but createPrismaWriteResolver could not be loaded'
    );
  }

  return {
    prisma: prisma as PrismaClientLike,
    createPrismaResolver: prismaPackage.createPrismaResolver,
    createPrismaWriteResolver: prismaPackage.createPrismaWriteResolver,
    scopeMode: config?.scopeMode,
  };
}

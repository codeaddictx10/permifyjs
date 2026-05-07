import { detectInstalledAdapter } from './detect';
import { loadMongooseRuntime } from './mongoose';
import { loadPrismaRuntime } from './prisma';
import type { AuthContext, ScopeMode } from '../../types';
import { normalizeScopeMode } from '../../scope';

type AuthModelLike = {
  id: string;
  modelType?: string;
};

export interface CliAdapterStrategy {
  scopeMode: ScopeMode;
  createRole(name: string,): Promise<'created' | 'exists'>;
  listRoles(): Promise<string[]>;
  assignRole(model: AuthModelLike, role: string, context?: AuthContext): Promise<void>;
  removeRole(model: AuthModelLike, role: string, context?: AuthContext): Promise<void>;
  createPermission(name: string): Promise<'created' | 'exists'>;
  listPermissions(): Promise<string[]>;
  assignPermissionToRole(
    role: string,
    permission: string,
    context?: AuthContext
  ): Promise<void>;
  getRoles(model: AuthModelLike, context?: AuthContext): Promise<string[]>;
  getPermissions(model: AuthModelLike, context?: AuthContext): Promise<string[]>;
  dispose(): Promise<void>;
}

export async function resolveCliAdapterStrategy(
  cwd = process.cwd()
): Promise<CliAdapterStrategy | null> {
  const adapter = detectInstalledAdapter(cwd);

  if (adapter === 'typeorm') {
    throw new Error(
      '[permifyjs] TypeORM CLI execution is not available yet because the @permifyjs/typeorm adapter package is not implemented in this repo'
    );
  }

  if (adapter === 'prisma') {
    const runtime = await loadPrismaRuntime(cwd);
    return runtime ? createPrismaStrategy(runtime) : null;
  }

  if (adapter === 'mongoose') {
    const runtime = await loadMongooseRuntime(cwd);
    return runtime ? createMongooseStrategy(runtime) : null;
  }

  return null;
}

function createPrismaStrategy(runtime: NonNullable<Awaited<ReturnType<typeof loadPrismaRuntime>>>): CliAdapterStrategy {
  const scopeMode = normalizeScopeMode(runtime.scopeMode);
  const resolver = runtime.createPrismaResolver(runtime.prisma, { scopeMode });
  const writeResolver = runtime.createPrismaWriteResolver(runtime.prisma, { scopeMode });

  return {
    scopeMode,
    async createRole(name: string) {
      const existing = await runtime.prisma.permifyRole?.findUnique({
        where: { name },
      });

      if (existing) return 'exists';

      await runtime.prisma.permifyRole?.create({
        data: { name },
      });

      return 'created';
    },

    async listRoles() {
      const roles =
        (await runtime.prisma.permifyRole?.findMany({
          orderBy: { name: 'asc' },
        })) ?? [];

      return roles.map((role) => role.name);
    },

    async assignRole(model: AuthModelLike, role: string, context?: AuthContext) {
      await writeResolver.assignRole(model, role, context);
    },

    async removeRole(model: AuthModelLike, role: string, context?: AuthContext) {
      await writeResolver.removeRole(model, role, context);
    },

    async createPermission(name: string) {
      const existing = await runtime.prisma.permifyPermission?.findUnique({
        where: { name },
      });

      if (existing) return 'exists';

      await runtime.prisma.permifyPermission?.create({
        data: { name },
      });

      return 'created';
    },

    async listPermissions() {
      const permissions =
        (await runtime.prisma.permifyPermission?.findMany({
          orderBy: { name: 'asc' },
        })) ?? [];

      return permissions.map((permission) => permission.name);
    },

    async assignPermissionToRole(
      role: string,
      permission: string,
      context?: AuthContext
    ) {
      await writeResolver.assignPermissionToRole(role, permission, context);
    },

    async getRoles(model: AuthModelLike, context?: AuthContext) {
      return resolver.getRoles(model, context);
    },

    async getPermissions(model: AuthModelLike, context?: AuthContext) {
      const [directPermissions, permissionsThroughRoles] = await Promise.all([
        resolver.getDirectPermissions(model, context),
        resolver.getPermissionsThroughRoles(model, context),
      ]);

      return [...new Set([...directPermissions, ...permissionsThroughRoles])].sort();
    },

    async dispose() {
      await runtime.prisma.$disconnect?.();
    },
  };
}

function createMongooseStrategy(runtime: NonNullable<Awaited<ReturnType<typeof loadMongooseRuntime>>>): CliAdapterStrategy {
  const scopeMode = normalizeScopeMode(runtime.scopeMode);
  const resolver = runtime.createMongooseResolver({
    connection: runtime.connection,
    collectionNames: runtime.collectionNames,
    scopeMode,
  });
  const writeResolver = runtime.createMongooseWriteResolver({
    connection: runtime.connection,
    collectionNames: runtime.collectionNames,
    scopeMode,
  });
  const Role = runtime.connection.model('PermifyRole');
  const Permission = runtime.connection.model('PermifyPermission');

  return {
    scopeMode,
    async createRole(name: string) {
      const existing = await Role.findOne({ name }).lean();
      if (existing) return 'exists';

      await Role.create({ name });
      return 'created';
    },

    async listRoles() {
      const roles = await Role.find({})
        .sort({ name: 1 })
        .select({ name: 1, _id: 0 })
        .lean();

      return roles.map((role: { name: string }) => role.name);
    },

    async assignRole(model: AuthModelLike, role: string, context?: AuthContext) {
      await writeResolver.assignRole(model, role, context);
    },

    async removeRole(model: AuthModelLike, role: string, context?: AuthContext) {
      await writeResolver.removeRole(model, role, context);
    },

    async createPermission(name: string) {
      const existing = await Permission.findOne({ name }).lean();
      if (existing) return 'exists';

      await Permission.create({ name });
      return 'created';
    },

    async listPermissions() {
      const permissions = await Permission.find({})
        .sort({ name: 1 })
        .select({ name: 1, _id: 0 })
        .lean();

      return permissions.map((permission: { name: string }) => permission.name);
    },

    async assignPermissionToRole(
      role: string,
      permission: string,
      context?: AuthContext
    ) {
      await writeResolver.assignPermissionToRole(role, permission, context);
    },

    async getRoles(model: AuthModelLike, context?: AuthContext) {
      return resolver.getRoles(model, context);
    },

    async getPermissions(model: AuthModelLike, context?: AuthContext) {
      const [directPermissions, permissionsThroughRoles] = await Promise.all([
        resolver.getDirectPermissions(model, context),
        resolver.getPermissionsThroughRoles(model, context),
      ]);

      return [...new Set([...directPermissions, ...permissionsThroughRoles])].sort();
    },

    async dispose() {
      await runtime.connection.close();
    },
  };
}

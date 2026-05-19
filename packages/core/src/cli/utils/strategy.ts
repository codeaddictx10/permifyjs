import { randomUUID } from 'node:crypto';
import { detectInstalledAdapter } from './detect';
import { loadMongooseRuntime } from './mongoose';
import { loadPrismaRuntime } from './prisma';
import { loadTypeOrmRuntime } from './typeorm';
import type { AuthContext, ScopeMode } from '../../types';
import { normalizeScopeMode } from '../../scope';

type AuthModelLike = {
  id: string;
  modelType?: string;
};

export interface CliAdapterStrategy {
  scopeMode: ScopeMode;
  createRole(name: string, context?: AuthContext): Promise<'created' | 'exists'>;
  listRoles(context?: AuthContext): Promise<string[]>;
  getRolePermissions(role: string, context?: AuthContext): Promise<string[]>;
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
  getDirectPermissions(model: AuthModelLike, context?: AuthContext): Promise<string[]>;
  getPermissionsThroughRoles(model: AuthModelLike, context?: AuthContext): Promise<string[]>;
  getPermissions(model: AuthModelLike, context?: AuthContext): Promise<string[]>;
  dispose(): Promise<void>;
}

export async function resolveCliAdapterStrategy(
  cwd = process.cwd()
): Promise<CliAdapterStrategy | null> {
  const adapter = detectInstalledAdapter(cwd);

  if (adapter === 'prisma') {
    const runtime = await loadPrismaRuntime(cwd);
    return runtime ? createPrismaStrategy(runtime) : null;
  }

  if (adapter === 'mongoose') {
    const runtime = await loadMongooseRuntime(cwd);
    return runtime ? createMongooseStrategy(runtime) : null;
  }

  if (adapter === 'typeorm') {
    const runtime = await loadTypeOrmRuntime(cwd);
    return runtime ? createTypeOrmStrategy(runtime) : null;
  }

  return null;
}

function createPrismaStrategy(runtime: NonNullable<Awaited<ReturnType<typeof loadPrismaRuntime>>>): CliAdapterStrategy {
  const scopeMode = normalizeScopeMode(runtime.scopeMode);
  const resolver = runtime.createPrismaResolver(runtime.prisma, { scopeMode });
  const writeResolver = runtime.createPrismaWriteResolver(runtime.prisma, { scopeMode });

  return {
    scopeMode,
    async createRole(name: string, context?: AuthContext) {
      const scope = context ?? {};
      const existing = await runtime.prisma.permifyRole?.findFirst({
        where: { name, ...scope },
      });

      if (existing) return 'exists';

      await runtime.prisma.permifyRole?.create({
        data: { name, ...scope },
      });

      return 'created';
    },

    async listRoles(context?: AuthContext) {
      const roles =
        (await runtime.prisma.permifyRole?.findMany({
          where: context ?? {},
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

    async getRolePermissions(role: string, context?: AuthContext) {
      return runtime.createPrismaResolver(runtime.prisma, { scopeMode }).getRolePermissions(
        role,
        context
      );
    },

    async getDirectPermissions(model: AuthModelLike, context?: AuthContext) {
      return resolver.getDirectPermissions(model, context);
    },

    async getPermissionsThroughRoles(model: AuthModelLike, context?: AuthContext) {
      return resolver.getPermissionsThroughRoles(model, context);
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
    async createRole(name: string, context?: AuthContext) {
      const existing = await Role.findOne({ name, ...(context ?? {}) }).lean();
      if (existing) return 'exists';

      await Role.create({ name, ...(context ?? {}) });
      return 'created';
    },

    async listRoles(context?: AuthContext) {
      const roles = await Role.find({ ...(context ?? {}) })
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

    async getRolePermissions(role: string, context?: AuthContext) {
      return resolver.getRolePermissions(role, context);
    },

    async getDirectPermissions(model: AuthModelLike, context?: AuthContext) {
      return resolver.getDirectPermissions(model, context);
    },

    async getPermissionsThroughRoles(model: AuthModelLike, context?: AuthContext) {
      return resolver.getPermissionsThroughRoles(model, context);
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

function createTypeOrmStrategy(runtime: NonNullable<Awaited<ReturnType<typeof loadTypeOrmRuntime>>>): CliAdapterStrategy {
  const scopeMode = normalizeScopeMode(runtime.scopeMode);
  const resolver = runtime.createTypeOrmResolver(runtime.dataSource, {
    tableNames: runtime.tableNames,
    scopeMode,
  });
  const writeResolver = runtime.createTypeOrmWriteResolver(runtime.dataSource, {
    tableNames: runtime.tableNames,
    scopeMode,
  });
  const tableNames = runtime.getPermifyTableNames(runtime.tableNames);

  return {
    scopeMode,
    async createRole(name: string, context?: AuthContext) {
      const query = runtime.dataSource
        .createQueryBuilder()
        .select('role.id', 'id')
        .from(tableNames.roles, 'role')
        .where('role.name = :name', { name });

      for (const [field, value] of Object.entries(context ?? {})) {
        query.andWhere(`role.${field} = :${field}`, { [field]: value });
      }

      const existing = await query.getRawOne<{ id: string }>();
      if (existing?.id) return 'exists';

      await runtime.dataSource
        .createQueryBuilder()
        .insert()
        .into(tableNames.roles)
        .values({
          id: randomUUID(),
          name,
          ...(context ?? {}),
        })
        .execute();

      return 'created';
    },

    async listRoles(context?: AuthContext) {
      const query = runtime.dataSource
        .createQueryBuilder()
        .select('role.name', 'name')
        .from(tableNames.roles, 'role')
        .orderBy('role.name', 'ASC');

      for (const [field, value] of Object.entries(context ?? {})) {
        query.andWhere(`role.${field} = :${field}`, { [field]: value });
      }

      const rows = await query.getRawMany<{ name: string }>();

      return rows.map((row) => row.name);
    },

    async assignRole(model: AuthModelLike, role: string, context?: AuthContext) {
      await writeResolver.assignRole(model, role, context);
    },

    async removeRole(model: AuthModelLike, role: string, context?: AuthContext) {
      await writeResolver.removeRole(model, role, context);
    },

    async createPermission(name: string) {
      return runtime.createPermifyRecord(
        runtime.dataSource,
        tableNames.permissions,
        name
      );
    },

    async listPermissions() {
      const rows = await runtime.dataSource
        .createQueryBuilder()
        .select('permission.name', 'name')
        .from(tableNames.permissions, 'permission')
        .orderBy('permission.name', 'ASC')
        .getRawMany<{ name: string }>();

      return rows.map((row) => row.name);
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

    async getRolePermissions(role: string, context?: AuthContext) {
      return resolver.getRolePermissions(role, context);
    },

    async getDirectPermissions(model: AuthModelLike, context?: AuthContext) {
      return resolver.getDirectPermissions(model, context);
    },

    async getPermissionsThroughRoles(model: AuthModelLike, context?: AuthContext) {
      return resolver.getPermissionsThroughRoles(model, context);
    },

    async getPermissions(model: AuthModelLike, context?: AuthContext) {
      const [directPermissions, permissionsThroughRoles] = await Promise.all([
        resolver.getDirectPermissions(model, context),
        resolver.getPermissionsThroughRoles(model, context),
      ]);

      return [...new Set([...directPermissions, ...permissionsThroughRoles])].sort();
    },

    async dispose() {
      if (runtime.initializedHere) {
        await runtime.dataSource.destroy?.();
      }
    },
  };
}

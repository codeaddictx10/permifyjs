import { detectInstalledAdapter } from './detect';
import { loadMongooseRuntime } from './mongoose';
import { loadPrismaRuntime } from './prisma';

type AuthModelLike = {
  id: string;
  modelType?: string;
};

export interface CliAdapterStrategy {
  createRole(name: string): Promise<'created' | 'exists'>;
  listRoles(): Promise<string[]>;
  assignRole(model: AuthModelLike, role: string): Promise<void>;
  removeRole(model: AuthModelLike, role: string): Promise<void>;
  createPermission(name: string): Promise<'created' | 'exists'>;
  listPermissions(): Promise<string[]>;
  assignPermissionToRole(role: string, permission: string): Promise<void>;
  getRoles(model: AuthModelLike): Promise<string[]>;
  getPermissions(model: AuthModelLike): Promise<string[]>;
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
  const resolver = runtime.createPrismaResolver(runtime.prisma);
  const writeResolver = runtime.createPrismaWriteResolver(runtime.prisma);

  return {
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

    async assignRole(model: AuthModelLike, role: string) {
      await writeResolver.assignRole(model, role);
    },

    async removeRole(model: AuthModelLike, role: string) {
      await writeResolver.removeRole(model, role);
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

    async assignPermissionToRole(role: string, permission: string) {
      await writeResolver.assignPermissionToRole(role, permission);
    },

    async getRoles(model: AuthModelLike) {
      return resolver.getRoles(model);
    },

    async getPermissions(model: AuthModelLike) {
      const [directPermissions, permissionsThroughRoles] = await Promise.all([
        resolver.getDirectPermissions(model),
        resolver.getPermissionsThroughRoles(model),
      ]);

      return [...new Set([...directPermissions, ...permissionsThroughRoles])].sort();
    },

    async dispose() {
      await runtime.prisma.$disconnect?.();
    },
  };
}

function createMongooseStrategy(runtime: NonNullable<Awaited<ReturnType<typeof loadMongooseRuntime>>>): CliAdapterStrategy {
  const resolver = runtime.createMongooseResolver({
    connection: runtime.connection,
    collectionNames: runtime.collectionNames,
  });
  const writeResolver = runtime.createMongooseWriteResolver({
    connection: runtime.connection,
    collectionNames: runtime.collectionNames,
  });
  const Role = runtime.connection.model('PermifyRole');
  const Permission = runtime.connection.model('PermifyPermission');

  return {
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

    async assignRole(model: AuthModelLike, role: string) {
      await writeResolver.assignRole(model, role);
    },

    async removeRole(model: AuthModelLike, role: string) {
      await writeResolver.removeRole(model, role);
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

    async assignPermissionToRole(role: string, permission: string) {
      await writeResolver.assignPermissionToRole(role, permission);
    },

    async getRoles(model: AuthModelLike) {
      return resolver.getRoles(model);
    },

    async getPermissions(model: AuthModelLike) {
      const [directPermissions, permissionsThroughRoles] = await Promise.all([
        resolver.getDirectPermissions(model),
        resolver.getPermissionsThroughRoles(model),
      ]);

      return [...new Set([...directPermissions, ...permissionsThroughRoles])].sort();
    },

    async dispose() {
      await runtime.connection.close();
    },
  };
}

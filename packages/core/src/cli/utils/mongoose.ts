import { readFileSync } from 'fs';
import { findProjectPermifyModule, loadProjectConfig, loadProjectPackage } from './project';

type AuthModelLike = {
  id: string;
  modelType?: string;
};

type CollectionNames = {
  roles?: string;
  permissions?: string;
  roleHasPermissions?: string;
  modelHasRoles?: string;
  modelHasPermissions?: string;
};

type MongooseConnectionLike = {
  close(): Promise<void>;
  model(name: string): any;
};

type MongooseResolverFactory = (options?: {
  connection?: MongooseConnectionLike;
  collectionNames?: CollectionNames;
}) => {
  getRoles(model: AuthModelLike): Promise<string[]>;
  getDirectPermissions(model: AuthModelLike): Promise<string[]>;
  getPermissionsThroughRoles(model: AuthModelLike): Promise<string[]>;
};

type MongooseWriteResolverFactory = (options?: {
  connection?: MongooseConnectionLike;
  collectionNames?: CollectionNames;
}) => {
  assignRole(model: AuthModelLike, role: string): Promise<void>;
  removeRole(model: AuthModelLike, role: string): Promise<void>;
  assignPermissionToRole(role: string, permission: string): Promise<void>;
};

type MongoosePackage = {
  createConnection(uri: string): {
    asPromise(): Promise<MongooseConnectionLike>;
  };
};

function resolveMongoUri(): string | null {
  return (
    process.env.MONGODB_URI ??
    process.env.MONGO_URL ??
    process.env.MONGO_URI ??
    process.env.MONGODB_URL ??
    process.env.DATABASE_URL ??
    null
  );
}

export async function loadMongooseRuntime(
  cwd = process.cwd()
): Promise<{
  connection: MongooseConnectionLike;
  createMongooseResolver: MongooseResolverFactory;
  createMongooseWriteResolver: MongooseWriteResolverFactory;
  collectionNames?: CollectionNames;
} | null> {
  const writeResolverPath = findProjectPermifyModule('writeResolver', cwd);
  if (!writeResolverPath) return null;
  const writeResolverSource = readFileSync(writeResolverPath, 'utf-8');
  if (!writeResolverSource.includes('createMongooseWriteResolver')) {
    return null;
  }

  const writeResolverModule = loadProjectPackage<{
    createMongooseWriteResolver?: MongooseWriteResolverFactory;
    createMongooseResolver?: MongooseResolverFactory;
  }>('@permifyjs/mongoose', cwd);

  if (
    typeof writeResolverModule.createMongooseWriteResolver !== 'function' ||
    typeof writeResolverModule.createMongooseResolver !== 'function'
  ) {
    throw new Error(
      '[permifyjs] @permifyjs/mongoose is installed but its resolver factories could not be loaded'
    );
  }

  const uri = resolveMongoUri();
  if (!uri) {
    throw new Error(
      '[permifyjs] Mongoose CLI execution requires one of MONGODB_URI, MONGO_URL, MONGO_URI, MONGODB_URL, or DATABASE_URL'
    );
  }

  const mongoose = loadProjectPackage<MongoosePackage>('mongoose', cwd);
  const connection = await mongoose.createConnection(uri).asPromise();
  const config = loadProjectConfig(cwd);

  return {
    connection,
    createMongooseResolver: writeResolverModule.createMongooseResolver,
    createMongooseWriteResolver: writeResolverModule.createMongooseWriteResolver,
    collectionNames: config?.tables,
  };
}

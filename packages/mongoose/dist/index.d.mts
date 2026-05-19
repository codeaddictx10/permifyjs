import { Mongoose, Connection, Model } from 'mongoose';
import { PermissionResolver, PermissionWriteResolver } from '@permifyjs/core';

type ScopeMode = 'global' | 'tenant' | 'team' | 'tenant-team';

interface PermifyCollectionNames {
    roles?: string;
    permissions?: string;
    roleHasPermissions?: string;
    modelHasRoles?: string;
    modelHasPermissions?: string;
}
interface RegisterPermifyModelsOptions {
    mongoose?: Mongoose;
    connection?: Connection;
    collectionNames?: PermifyCollectionNames;
    scopeMode?: ScopeMode;
}
interface PermifyRoleDocument {
    name: string;
    tenantId?: string;
    teamId?: string;
    createdAt?: Date;
    updatedAt?: Date;
}
interface PermifyPermissionDocument {
    name: string;
    createdAt?: Date;
    updatedAt?: Date;
}
interface PermifyRoleHasPermissionDocument {
    roleId: unknown;
    permissionId: unknown;
    tenantId?: string;
    teamId?: string;
}
interface PermifyModelHasRoleDocument {
    modelId: string;
    modelType: string;
    tenantId?: string;
    teamId?: string;
    roleId: unknown;
}
interface PermifyModelHasPermissionDocument {
    modelId: string;
    modelType: string;
    tenantId?: string;
    teamId?: string;
    permissionId: unknown;
}
interface PermifyModels {
    Role: Model<PermifyRoleDocument>;
    Permission: Model<PermifyPermissionDocument>;
    RoleHasPermission: Model<PermifyRoleHasPermissionDocument>;
    ModelHasRole: Model<PermifyModelHasRoleDocument>;
    ModelHasPermission: Model<PermifyModelHasPermissionDocument>;
}
declare function registerPermifyModels(options?: RegisterPermifyModelsOptions): PermifyModels;

interface MongooseResolverOptions extends RegisterPermifyModelsOptions {
}
declare function createMongooseResolver(options?: MongooseResolverOptions): PermissionResolver;

interface MongooseWriteResolverOptions extends RegisterPermifyModelsOptions {
}
declare function createMongooseWriteResolver(options?: MongooseWriteResolverOptions): PermissionWriteResolver;

export { type MongooseResolverOptions, type MongooseWriteResolverOptions, type PermifyCollectionNames, type PermifyModels, type RegisterPermifyModelsOptions, createMongooseResolver, createMongooseWriteResolver, registerPermifyModels };

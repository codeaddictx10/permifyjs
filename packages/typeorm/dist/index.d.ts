import { AuthContext, PermissionResolver, PermissionWriteResolver } from '@permifyjs/core';
import { DataSource } from 'typeorm';

type ScopeMode = 'global' | 'tenant' | 'team' | 'tenant-team';
declare const GLOBAL_SCOPE = "__permify_global__";
type ScopeField = 'tenantId' | 'teamId';
type ScopeRecord = Partial<Record<ScopeField, string>>;
declare function getEnabledScopeFields(scopeMode?: ScopeMode): Array<'tenantId' | 'teamId'>;
declare function normalizeScope(scopeMode: ScopeMode | undefined, context?: AuthContext): ScopeRecord;

interface PermifyTableNames {
    roles?: string;
    permissions?: string;
    roleHasPermissions?: string;
    modelHasRoles?: string;
    modelHasPermissions?: string;
}
interface TypeOrmSchemaOptions {
    tableNames?: PermifyTableNames;
    scopeMode?: ScopeMode;
}
interface PermifySchemaStatus {
    allPresent: boolean;
    tables: Record<keyof Required<PermifyTableNames>, boolean>;
}
type ResolvedTableNames = Required<PermifyTableNames>;
declare function getPermifyTableNames(tableNames?: PermifyTableNames): ResolvedTableNames;
declare function getPermifySchemaStatus(dataSource: DataSource, options?: TypeOrmSchemaOptions): Promise<PermifySchemaStatus>;
declare function syncPermifySchema(dataSource: DataSource, options?: TypeOrmSchemaOptions): Promise<void>;
declare function dropPermifySchema(dataSource: DataSource, options?: TypeOrmSchemaOptions): Promise<void>;

interface TypeOrmResolverOptions {
    tableNames?: PermifyTableNames;
    scopeMode?: ScopeMode;
}
declare function createTypeOrmResolver(dataSource: DataSource, options?: TypeOrmResolverOptions): PermissionResolver;

interface TypeOrmWriteResolverOptions {
    tableNames?: PermifyTableNames;
    scopeMode?: ScopeMode;
}
declare function createTypeOrmWriteResolver(dataSource: DataSource, options?: TypeOrmWriteResolverOptions): PermissionWriteResolver;
declare function createPermifyRecord(dataSource: DataSource, tableName: string, name: string): Promise<'created' | 'exists'>;

export { GLOBAL_SCOPE, type PermifySchemaStatus, type PermifyTableNames, type TypeOrmResolverOptions, type TypeOrmSchemaOptions, type TypeOrmWriteResolverOptions, createPermifyRecord, createTypeOrmResolver, createTypeOrmWriteResolver, dropPermifySchema, getEnabledScopeFields, getPermifySchemaStatus, getPermifyTableNames, normalizeScope, syncPermifySchema };

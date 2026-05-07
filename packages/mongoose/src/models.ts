import mongoose, {
  Schema,
  type Connection,
  type Model,
  type Mongoose,
} from 'mongoose';
import { GLOBAL_SCOPE, getScopedIndexShape, type ScopeMode } from './scope';

export interface PermifyCollectionNames {
  roles?: string;
  permissions?: string;
  roleHasPermissions?: string;
  modelHasRoles?: string;
  modelHasPermissions?: string;
}

export interface RegisterPermifyModelsOptions {
  mongoose?: Mongoose;
  connection?: Connection;
  collectionNames?: PermifyCollectionNames;
  scopeMode?: ScopeMode;
}

const DEFAULT_MODEL_NAMES = {
  role: 'PermifyRole',
  permission: 'PermifyPermission',
  roleHasPermission: 'PermifyRoleHasPermission',
  modelHasRole: 'PermifyModelHasRole',
  modelHasPermission: 'PermifyModelHasPermission',
} as const;

const DEFAULT_COLLECTIONS = {
  roles: 'roles',
  permissions: 'permissions',
  roleHasPermissions: 'role_has_permissions',
  modelHasRoles: 'model_has_roles',
  modelHasPermissions: 'model_has_permissions',
} as const;

export interface PermifyRoleDocument {
  name: string;
  tenantId?: string;
  teamId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PermifyPermissionDocument {
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PermifyRoleHasPermissionDocument {
  roleId: unknown;
  permissionId: unknown;
  tenantId?: string;
  teamId?: string;
}

export interface PermifyModelHasRoleDocument {
  modelId: string;
  modelType: string;
  tenantId?: string;
  teamId?: string;
  roleId: unknown;
}

export interface PermifyModelHasPermissionDocument {
  modelId: string;
  modelType: string;
  tenantId?: string;
  teamId?: string;
  permissionId: unknown;
}

export interface PermifyModels {
  Role: Model<PermifyRoleDocument>;
  Permission: Model<PermifyPermissionDocument>;
  RoleHasPermission: Model<PermifyRoleHasPermissionDocument>;
  ModelHasRole: Model<PermifyModelHasRoleDocument>;
  ModelHasPermission: Model<PermifyModelHasPermissionDocument>;
}

function getRegistry(options: RegisterPermifyModelsOptions = {}) {
  return options.connection ?? options.mongoose ?? mongoose;
}

function getCollectionName(
  key: keyof typeof DEFAULT_COLLECTIONS,
  options?: RegisterPermifyModelsOptions
): string {
  return options?.collectionNames?.[key] ?? DEFAULT_COLLECTIONS[key];
}

const REGISTRY_SCOPE_MODE = Symbol.for('permifyjs.scopeMode');

function getEnabledScopeFields(
  scopeMode?: ScopeMode
): Array<'tenantId' | 'teamId'> {
  switch (scopeMode ?? 'tenant-team') {
    case 'global':
      return [];
    case 'tenant':
      return ['tenantId'];
    case 'team':
      return ['teamId'];
    default:
      return ['tenantId', 'teamId'];
  }
}

function getResolvedScopeMode(options?: RegisterPermifyModelsOptions): ScopeMode {
  return options?.scopeMode ?? 'tenant-team';
}

function getScopeSchemaFields(scopeMode?: ScopeMode) {
  const fields: Record<string, any> = {};

  for (const field of getEnabledScopeFields(scopeMode)) {
    fields[field] = {
      type: String,
      required: true,
      default: GLOBAL_SCOPE,
      index: true,
    };
  }

  return fields;
}

function assertRegistryScopeMode(
  registry: ReturnType<typeof getRegistry>,
  scopeMode: ScopeMode
): void {
  const existingScopeMode = (registry as any)[REGISTRY_SCOPE_MODE] as
    | ScopeMode
    | undefined;

  if (existingScopeMode && existingScopeMode !== scopeMode) {
    throw new Error(
      `[permifyjs] registerPermifyModels() already initialized this Mongoose registry with scopeMode "${existingScopeMode}". Received "${scopeMode}".`
    );
  }

  (registry as any)[REGISTRY_SCOPE_MODE] = scopeMode;
}

function createRoleSchema(collectionName: string, scopeMode?: ScopeMode): Schema<PermifyRoleDocument> {
  return new Schema(
    {
      name: { type: String, required: true, unique: true, index: true },
      ...getScopeSchemaFields(scopeMode),
    },
    {
      timestamps: true,
      collection: collectionName,
    }
  );
}

function createPermissionSchema(
  collectionName: string
): Schema<PermifyPermissionDocument> {
  return new Schema(
    {
      name: { type: String, required: true, unique: true, index: true },
    },
    {
      timestamps: true,
      collection: collectionName,
    }
  );
}

function createRoleHasPermissionSchema(
  collectionName: string,
  scopeMode?: ScopeMode
): Schema<PermifyRoleHasPermissionDocument> {
  const schema = new Schema(
    {
      roleId: {
        type: Schema.Types.ObjectId,
        ref: DEFAULT_MODEL_NAMES.role,
        required: true,
        index: true,
      },
      permissionId: {
        type: Schema.Types.ObjectId,
        ref: DEFAULT_MODEL_NAMES.permission,
        required: true,
        index: true,
      },
      ...getScopeSchemaFields(scopeMode),
    },
    {
      timestamps: false,
      collection: collectionName,
    }
  );

  schema.index(
    getScopedIndexShape({ roleId: 1, permissionId: 1 }, {}, scopeMode),
    { unique: true }
  );
  return schema;
}

function createModelHasRoleSchema(
  collectionName: string,
  scopeMode?: ScopeMode
): Schema<PermifyModelHasRoleDocument> {
  const schema = new Schema(
    {
      modelId: { type: String, required: true, index: true },
      modelType: { type: String, required: true, index: true },
      ...getScopeSchemaFields(scopeMode),
      roleId: {
        type: Schema.Types.ObjectId,
        ref: DEFAULT_MODEL_NAMES.role,
        required: true,
        index: true,
      },
    },
    {
      timestamps: false,
      collection: collectionName,
    }
  );

  schema.index(
    getScopedIndexShape({ modelId: 1, modelType: 1 }, { roleId: 1 }, scopeMode),
    { unique: true }
  );
  return schema;
}

function createModelHasPermissionSchema(
  collectionName: string,
  scopeMode?: ScopeMode
): Schema<PermifyModelHasPermissionDocument> {
  const schema = new Schema(
    {
      modelId: { type: String, required: true, index: true },
      modelType: { type: String, required: true, index: true },
      ...getScopeSchemaFields(scopeMode),
      permissionId: {
        type: Schema.Types.ObjectId,
        ref: DEFAULT_MODEL_NAMES.permission,
        required: true,
        index: true,
      },
    },
    {
      timestamps: false,
      collection: collectionName,
    }
  );

  schema.index(
    getScopedIndexShape(
      { modelId: 1, modelType: 1 },
      { permissionId: 1 },
      scopeMode
    ),
    { unique: true }
  );
  return schema;
}

export function registerPermifyModels(
  options: RegisterPermifyModelsOptions = {}
): PermifyModels {
  const registry = getRegistry(options);
  const scopeMode = getResolvedScopeMode(options);
  assertRegistryScopeMode(registry, scopeMode);

  const Role =
    registry.models[DEFAULT_MODEL_NAMES.role] ??
    registry.model(
      DEFAULT_MODEL_NAMES.role,
      createRoleSchema(getCollectionName('roles', options), scopeMode)
    );

  const Permission =
    registry.models[DEFAULT_MODEL_NAMES.permission] ??
    registry.model(
      DEFAULT_MODEL_NAMES.permission,
      createPermissionSchema(getCollectionName('permissions', options))
    );

  const RoleHasPermission =
    registry.models[DEFAULT_MODEL_NAMES.roleHasPermission] ??
    registry.model(
      DEFAULT_MODEL_NAMES.roleHasPermission,
      createRoleHasPermissionSchema(
        getCollectionName('roleHasPermissions', options),
        scopeMode
      )
    );

  const ModelHasRole =
    registry.models[DEFAULT_MODEL_NAMES.modelHasRole] ??
    registry.model(
      DEFAULT_MODEL_NAMES.modelHasRole,
      createModelHasRoleSchema(getCollectionName('modelHasRoles', options), scopeMode)
    );

  const ModelHasPermission =
    registry.models[DEFAULT_MODEL_NAMES.modelHasPermission] ??
    registry.model(
      DEFAULT_MODEL_NAMES.modelHasPermission,
      createModelHasPermissionSchema(
        getCollectionName('modelHasPermissions', options),
        scopeMode
      )
    );

  return {
    Role,
    Permission,
    RoleHasPermission,
    ModelHasRole,
    ModelHasPermission,
  };
}

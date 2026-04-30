import mongoose, {
  Schema,
  type Connection,
  type Model,
  type Mongoose,
} from 'mongoose';

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
}

export interface PermifyModelHasRoleDocument {
  modelId: string;
  modelType: string;
  roleId: unknown;
}

export interface PermifyModelHasPermissionDocument {
  modelId: string;
  modelType: string;
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

function createRoleSchema(collectionName: string): Schema<PermifyRoleDocument> {
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
  collectionName: string
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
    },
    {
      timestamps: false,
      collection: collectionName,
    }
  );

  schema.index({ roleId: 1, permissionId: 1 }, { unique: true });
  return schema;
}

function createModelHasRoleSchema(
  collectionName: string
): Schema<PermifyModelHasRoleDocument> {
  const schema = new Schema(
    {
      modelId: { type: String, required: true, index: true },
      modelType: { type: String, required: true, index: true },
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

  schema.index({ modelId: 1, modelType: 1, roleId: 1 }, { unique: true });
  return schema;
}

function createModelHasPermissionSchema(
  collectionName: string
): Schema<PermifyModelHasPermissionDocument> {
  const schema = new Schema(
    {
      modelId: { type: String, required: true, index: true },
      modelType: { type: String, required: true, index: true },
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

  schema.index({ modelId: 1, modelType: 1, permissionId: 1 }, { unique: true });
  return schema;
}

export function registerPermifyModels(
  options: RegisterPermifyModelsOptions = {}
): PermifyModels {
  const registry = getRegistry(options);

  const Role =
    registry.models[DEFAULT_MODEL_NAMES.role] ??
    registry.model(
      DEFAULT_MODEL_NAMES.role,
      createRoleSchema(getCollectionName('roles', options))
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
        getCollectionName('roleHasPermissions', options)
      )
    );

  const ModelHasRole =
    registry.models[DEFAULT_MODEL_NAMES.modelHasRole] ??
    registry.model(
      DEFAULT_MODEL_NAMES.modelHasRole,
      createModelHasRoleSchema(getCollectionName('modelHasRoles', options))
    );

  const ModelHasPermission =
    registry.models[DEFAULT_MODEL_NAMES.modelHasPermission] ??
    registry.model(
      DEFAULT_MODEL_NAMES.modelHasPermission,
      createModelHasPermissionSchema(
        getCollectionName('modelHasPermissions', options)
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

import type {
  PermissionResolver,
  PermissionWriteResolver,
  AuthModel,
  AuthContext,
} from '@permifyjs/core';

// ─── In-memory store (replace with your DB) ───────────────────────
// This example scopes data with tenantId/teamId so you can see how
// multitenant authorization works with the current API.

const modelKey = (model: AuthModel) => `${model.modelType ?? 'User'}:${model.id}`;
const scopeKey = (context?: AuthContext) =>
  `${context?.tenantId ?? 'global'}:${context?.teamId ?? 'global'}`;
const membershipKey = (model: AuthModel, context?: AuthContext) =>
  `${modelKey(model)}:${scopeKey(context)}`;
const roleScopeKey = (role: string, context?: AuthContext) =>
  `${role}:${scopeKey(context)}`;
const tenantContext = (context?: AuthContext): AuthContext => ({
  tenantId: context?.tenantId,
});

const teamRolesMap: Record<string, string[]> = {
  'User:1:acme:design': ['team-admin'],
  'User:1:acme:support': ['team-viewer'],
  'User:2:acme:design': ['editor'],
  'User:3:globex:ops': ['team-viewer'],
};

const tenantPermissionsMap: Record<string, string[]> = {
  'User:1:acme:global': ['billing.view', 'post.publish'],
  'User:2:acme:global': [],
  'User:3:globex:global': ['report.export'],
};

const scopedRolePermissionsMap: Record<string, string[]> = {
  'team-admin:acme:design': [
    'post.create',
    'post.edit',
    'post.delete',
    'member.invite',
  ],
  'editor:acme:design': ['post.create', 'post.edit'],
  'team-viewer:acme:support': ['post.view'],
  'team-viewer:globex:ops': ['incident.view'],
};

// ─── Read resolver ────────────────────────────────────────────────

export const resolver: PermissionResolver = {
  getRoles: async (model: AuthModel, context?: AuthContext) => {
    console.log(
      `[resolver] getRoles — ${model.modelType ?? 'User'}:${model.id}`,
      context ?? ''
    );
    return teamRolesMap[membershipKey(model, context)] ?? [];
  },

  getDirectPermissions: async (model: AuthModel, context?: AuthContext) => {
    console.log(
      `[resolver] getDirectPermissions — ${model.modelType ?? 'User'}:${model.id}`,
      context ?? ''
    );
    return tenantPermissionsMap[membershipKey(model, tenantContext(context))] ?? [];
  },

  getPermissionsThroughRoles: async (
    model: AuthModel,
    context?: AuthContext
  ) => {
    console.log(
      `[resolver] getPermissionsThroughRoles — ${model.modelType ?? 'User'}:${model.id}`,
      context ?? ''
    );
    const roles = teamRolesMap[membershipKey(model, context)] ?? [];
    const permissions = roles.flatMap(
      (role) => scopedRolePermissionsMap[roleScopeKey(role, context)] ?? []
    );
    return [...new Set(permissions)];
  },

  getRolePermissions: async (role: string, context?: AuthContext) => {
    console.log(`[resolver] getRolePermissions — role: ${role}`, context ?? '');
    return scopedRolePermissionsMap[roleScopeKey(role, context)] ?? [];
  },
};

// ─── Write resolver ───────────────────────────────────────────────

export const writeResolver: PermissionWriteResolver = {
  assignRole: async (model: AuthModel, role: string, context?: AuthContext) => {
    const key = membershipKey(model, context);
    if (!teamRolesMap[key]) teamRolesMap[key] = [];
    if (!teamRolesMap[key].includes(role)) teamRolesMap[key].push(role);
    console.log(
      `[writeResolver] assignRole — ${model.modelType ?? 'User'}:${model.id}, role: ${role}`,
      context ?? ''
    );
  },

  removeRole: async (model: AuthModel, role: string, context?: AuthContext) => {
    const key = membershipKey(model, context);
    if (teamRolesMap[key]) {
      teamRolesMap[key] = teamRolesMap[key].filter((item) => item !== role);
    }
    console.log(
      `[writeResolver] removeRole — ${model.modelType ?? 'User'}:${model.id}, role: ${role}`,
      context ?? ''
    );
  },

  syncRoles: async (
    model: AuthModel,
    roles: string[],
    context?: AuthContext
  ) => {
    teamRolesMap[membershipKey(model, context)] = [...roles];
    console.log(
      `[writeResolver] syncRoles — ${model.modelType ?? 'User'}:${model.id}, roles: ${roles}`,
      context ?? ''
    );
  },

  givePermissionTo: async (
    model: AuthModel,
    permission: string,
    context?: AuthContext
  ) => {
    const key = membershipKey(model, tenantContext(context));
    if (!tenantPermissionsMap[key]) tenantPermissionsMap[key] = [];
    if (!tenantPermissionsMap[key].includes(permission)) {
      tenantPermissionsMap[key].push(permission);
    }
    console.log(
      `[writeResolver] givePermissionTo — ${model.modelType ?? 'User'}:${model.id}, permission: ${permission}`,
      context ?? ''
    );
  },

  revokePermissionTo: async (
    model: AuthModel,
    permission: string,
    context?: AuthContext
  ) => {
    const key = membershipKey(model, tenantContext(context));
    if (tenantPermissionsMap[key]) {
      tenantPermissionsMap[key] = tenantPermissionsMap[key].filter(
        (item) => item !== permission
      );
    }
    console.log(
      `[writeResolver] revokePermissionTo — ${model.modelType ?? 'User'}:${model.id}, permission: ${permission}`,
      context ?? ''
    );
  },

  syncPermissions: async (
    model: AuthModel,
    permissions: string[],
    context?: AuthContext
  ) => {
    tenantPermissionsMap[membershipKey(model, tenantContext(context))] = [
      ...permissions,
    ];
    console.log(
      `[writeResolver] syncPermissions — ${model.modelType ?? 'User'}:${model.id}, permissions: ${permissions}`,
      context ?? ''
    );
  },

  assignPermissionToRole: async (
    role: string,
    permission: string,
    context?: AuthContext
  ) => {
    const key = roleScopeKey(role, context);
    if (!scopedRolePermissionsMap[key]) scopedRolePermissionsMap[key] = [];
    if (!scopedRolePermissionsMap[key].includes(permission)) {
      scopedRolePermissionsMap[key].push(permission);
    }
    console.log(
      `[writeResolver] assignPermissionToRole — role: ${role}, permission: ${permission}`,
      context ?? ''
    );
  },

  revokePermissionFromRole: async (
    role: string,
    permission: string,
    context?: AuthContext
  ) => {
    const key = roleScopeKey(role, context);
    if (scopedRolePermissionsMap[key]) {
      scopedRolePermissionsMap[key] = scopedRolePermissionsMap[key].filter(
        (item) => item !== permission
      );
    }
    console.log(
      `[writeResolver] revokePermissionFromRole — role: ${role}, permission: ${permission}`,
      context ?? ''
    );
  },

  syncRolePermissions: async (
    role: string,
    permissions: string[],
    context?: AuthContext
  ) => {
    scopedRolePermissionsMap[roleScopeKey(role, context)] = [...permissions];
    console.log(
      `[writeResolver] syncRolePermissions — role: ${role}, permissions: ${permissions}`,
      context ?? ''
    );
  },
};

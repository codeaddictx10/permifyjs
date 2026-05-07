# Team And Tenant Patterns

PermifyJS does not invent tenancy rules for you. `context` is a plain object that your resolver can use to scope reads and writes.

For projects created with `permifyjs init`, scope is explicit through `scopeMode` in `permifyjs.config.ts`:

- `global`: no tenant/team fields in the generated DB shape
- `tenant`: only `tenantId`
- `team`: only `teamId`
- `tenant-team`: both

That means:

- pass `tenantId` when permissions should be isolated per tenant
- pass `teamId` when permissions should be isolated per team
- pass both when a team belongs to a tenant and the same team slug can exist in different tenants
- only pass the fields that match your selected `scopeMode`

## Mental Model

The core API stays the same:

```ts
await auth.can(model, 'post.edit', {
  tenantId: 'acme',
  teamId: 'marketing',
});
```

What changes is your resolver logic. The resolver decides how to persist and look up assignments for that scope.

## Pattern 1: Team-Scoped Roles

Use this when a user can be an `admin` in one team and only a `viewer` in another.

```ts
const membershipKey = (model, context) =>
  `${model.modelType ?? 'User'}:${model.id}:${context?.teamId ?? 'global'}`;

const teamRoles = {
  'User:1:design': ['team-admin'],
  'User:1:support': ['viewer'],
};

const resolver = {
  async getRoles(model, context) {
    return teamRoles[membershipKey(model, context)] ?? [];
  },
};
```

Use this shape when requests carry a team header, subdomain, route param, or session field.

## Pattern 2: Tenant-Scoped Permissions

Use this when the same user belongs to multiple workspaces or organizations and direct permissions must not leak across them.

```ts
const permissionKey = (model, context) =>
  `${model.modelType ?? 'User'}:${model.id}:${context?.tenantId ?? 'global'}`;

const directPermissions = {
  'User:1:acme': ['billing.view'],
  'User:1:globex': [],
};

const resolver = {
  async getDirectPermissions(model, context) {
    return directPermissions[permissionKey(model, context)] ?? [];
  },
};
```

## Pattern 3: Tenant + Team Together

Use both keys when teams exist inside tenants:

```ts
const scopedKey = (model, context) =>
  [
    model.modelType ?? 'User',
    model.id,
    context?.tenantId ?? 'global',
    context?.teamId ?? 'global',
  ].join(':');
```

This avoids collisions like `teamId = "engineering"` appearing in more than one tenant.

## Recommended Request Mapping

Map the current request into an `AuthContext` at the framework boundary:

```ts
const { authorize } = createExpressAdapter(auth, {
  getUser: (req) => ({
    id: req.headers['x-user-id'] as string,
    modelType: 'User',
  }),
  getContext: (req) => ({
    tenantId: req.headers['x-tenant-id'] as string,
    teamId: req.headers['x-team-id'] as string,
  }),
});
```

In NestJS:

```ts
PermifyModule.forRoot({
  auth,
  getUser: (req) => req.user,
  getContext: (req) => ({
    tenantId: req.headers['x-tenant-id'],
    teamId: req.headers['x-team-id'],
  }),
});
```

## Write Operations Must Use The Same Scope

If you assign a role inside a team or tenant, pass the same context to the write methods:

```ts
await auth.assignRole(
  { id: '1', modelType: 'User' },
  'team-admin',
  { tenantId: 'acme', teamId: 'design' }
);
```

Without the matching context, you are writing to a different scope than the one you check later.

## Built-In Adapter Storage

The built-in Prisma and Mongoose adapters now persist scope on the join rows they manage, but only for the fields enabled by `scopeMode`:

- `global`: no scope columns or fields
- `tenant`: only `tenantId`
- `team`: only `teamId`
- `tenant-team`: both `tenantId` and `teamId`

When a scope dimension is enabled but omitted from the runtime context, the built-in adapters use the sentinel string `__permify_global__` for that enabled dimension. Disabled dimensions are not stored at all.

## Practical Data Shapes

These shapes work well in real applications:

- SQL: `model_type`, `model_id`, `tenant_id`, `team_id`, `role`
- MongoDB: `{ modelType, modelId, tenantId, teamId, role }`
- External membership service: `getRoles(model, context)` delegates to the service using both IDs

If you design your own adapter, you can use nullable scope columns or your own sentinel value. The built-in adapters use `__permify_global__`.

## Example Reference

See [examples/express-app/src/resolver.ts](/Users/CodeAddictx/Desktop/dev/packages/permifyjs/examples/express-app/src/resolver.ts) and [examples/express-app/src/index.ts](/Users/CodeAddictx/Desktop/dev/packages/permifyjs/examples/express-app/src/index.ts) for a full in-memory example using:

- team-scoped roles
- tenant-scoped direct permissions
- tenant+team-scoped role permissions

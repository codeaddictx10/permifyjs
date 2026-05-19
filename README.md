# PermifyJS

PermifyJS is a Spatie-inspired roles and permissions library for JavaScript and TypeScript.

> Beta warning
>
> PermifyJS is still in beta and is not recommended for production use yet unless explicitly stated otherwise.

It is built for Node.js teams that want:

- a database-agnostic authorization core
- framework adapters instead of framework lock-in
- role and permission checks with a clean DX
- support for polymorphic models through `AuthModel`
- room for multitenant and team-aware authorization

## Install

Install only the packages that match your stack.

```bash
pnpm add @permifyjs/core
```

For Express with Prisma:

```bash
pnpm add @permifyjs/core @permifyjs/express @permifyjs/prisma
```

For Express with Mongoose:

```bash
pnpm add @permifyjs/core @permifyjs/express @permifyjs/mongoose
```

For Fastify:

```bash
pnpm add @permifyjs/core @permifyjs/fastify fastify
```

For Express with TypeORM:

```bash
pnpm add @permifyjs/core @permifyjs/express @permifyjs/typeorm typeorm
```

For NestJS:

```bash
pnpm add @permifyjs/core @permifyjs/nestjs
```

## Package Status

Current packages in this repo:

- `@permifyjs/core`
- `@permifyjs/express`
- `@permifyjs/fastify`
- `@permifyjs/nestjs`
- `@permifyjs/prisma`
- `@permifyjs/mongoose`
- `@permifyjs/typeorm`

Not shipped in this repo yet:

- none

## Core Concepts

PermifyJS works around an `AuthModel` instead of assuming only a `User`.

```ts
interface AuthModel {
  id: string;
  modelType?: string;
}
```

If `modelType` is omitted, it defaults to `"User"`.

This allows authorization for users, admins, API clients, service accounts, or any other model you want to authorize.

## Core API

```ts
auth.can(model, permission, context?)
auth.hasRole(model, role, context?)

auth.canDirectly(model, permission, context?)
auth.canThroughRole(model, permission, context?)

auth.assignRole(model, role, context?)
auth.removeRole(model, role, context?)
auth.syncRoles(model, roles, context?)

auth.givePermissionTo(model, permission, context?)
auth.revokePermissionTo(model, permission, context?)
auth.syncPermissions(model, permissions, context?)

auth.assignPermissionToRole(role, permission, context?)
auth.revokePermissionFromRole(role, permission, context?)
auth.syncRolePermissions(role, permissions, context?)
```

The core package also includes:

- wildcard permissions like `post.*`
- in-memory caching
- role helpers through `auth.role("admin")`
- DX utilities such as `hasAnyRole()` and `hasAnyPermission()`
- a CLI for setup and management tasks

## Quick Start

```ts
import { createAuth } from '@permifyjs/core';

const resolver = {
  async getRoles(model) {
    if (model.id === '1') return ['admin'];
    return ['editor'];
  },
  async getDirectPermissions(model) {
    if (model.id === '1') return ['post.publish'];
    return [];
  },
  async getPermissionsThroughRoles(model) {
    if (model.id === '1') return ['post.create', 'post.edit', 'post.delete'];
    return ['post.create', 'post.edit'];
  },
  async getRolePermissions(role) {
    const map = {
      admin: ['post.create', 'post.edit', 'post.delete'],
      editor: ['post.create', 'post.edit'],
    };
    return map[role] ?? [];
  },
};

const auth = createAuth({
  resolver,
  beforeCheck: ({ model }) => {
    if (model.isSuperAdmin) return true;
    return null;
  },
  cache: { ttl: 60 },
});

const user = { id: '1', modelType: 'User', isSuperAdmin: false };

await auth.can(user, 'post.edit');
await auth.hasRole(user, 'admin');
await auth.assignRole(user, 'editor');
```

See the full setup flow in [docs/quick-start.md](/Users/CodeAddictx/Desktop/dev/packages/permifyjs/docs/quick-start.md).

## Express

```ts
import express from 'express';
import { createAuth } from '@permifyjs/core';
import { createExpressAdapter } from '@permifyjs/express';

const auth = createAuth({ resolver, writeResolver });
const { authorize, authorizeRole } = createExpressAdapter(auth, {
  getUser: (req) => ({
    id: req.headers['x-user-id'] as string,
    modelType: 'User',
  }),
  getContext: (req) => ({
    teamId: req.headers['x-team-id'] as string,
  }),
});

const app = express();

app.get('/posts', authorize('post.create'), (req, res) => {
  res.json({ ok: true });
});

app.delete('/posts/:id', authorizeRole('admin'), (req, res) => {
  res.json({ ok: true });
});
```

## NestJS

Use `@permifyjs/nestjs` with `PermifyModule`, `PermifyGuard`, `RequirePermissions`, and `RequireRoles`.

See [docs/quick-start.md](/Users/CodeAddictx/Desktop/dev/packages/permifyjs/docs/quick-start.md) for the setup flow.

## Prisma Adapter

`@permifyjs/prisma` provides:

- `createPrismaResolver(prisma)`
- `createPrismaWriteResolver(prisma)`

Use the generated schema fragment from the CLI or the schema in [packages/prisma/src/schema.prisma](/Users/CodeAddictx/Desktop/dev/packages/permifyjs/packages/prisma/src/schema.prisma).

`permifyjs init` now writes `scopeMode` into `permifyjs.config.ts` and generates a mode-specific schema fragment:

- `global`: no `tenantId` or `teamId`
- `tenant`: only `tenantId`
- `team`: only `teamId`
- `tenant-team`: both fields

The package source schema is the full `tenant-team` variant for direct adapter consumers who do not pass a `scopeMode`.

## Mongoose Adapter

`@permifyjs/mongoose` provides:

- `registerPermifyModels()`
- `createMongooseResolver()`
- `createMongooseWriteResolver()`

Call `registerPermifyModels({ scopeMode })` before your application starts using the resolver layer so the required collections and models are registered with the expected schema shape.

## TypeORM Adapter

`@permifyjs/typeorm` provides:

- `createTypeOrmResolver(dataSource)`
- `createTypeOrmWriteResolver(dataSource)`
- `syncPermifySchema(dataSource)`
- `dropPermifySchema(dataSource)`

TypeORM is a first-class adapter in this repo. `permifyjs init` will ask for your exported `dataSource` import path, and `permifyjs migrate` will create the required adapter tables for the configured `scopeMode`.

## CLI

The core package exposes a CLI:

```bash
permifyjs init
permifyjs migrate
permifyjs role:create admin
permifyjs role:create admin --tenant-id acme --team-id design
permifyjs role:list --tenant-id acme --team-id design
permifyjs matrix --tenant-id acme --team-id design
permifyjs cache:clear
permifyjs permission:create post.create
permifyjs role:assign --model-id 1 --model-type User --role admin
permifyjs user:direct-permissions --model-id 1 --model-type User
permifyjs user:permissions-via-roles --model-id 1 --model-type User
permifyjs user:permissions --model-id 1 --model-type User
```

Typical local workflow:

```bash
pnpm exec permifyjs init
pnpm exec permifyjs migrate
```

The generated Prisma files now use the Prisma client import path you confirm during `init`, instead of assuming one fixed project structure. `init` also asks which scope model your app uses and stores it as `scopeMode`. In scoped projects, `role:create` and `role:list` accept the same `--tenant-id` / `--team-id` flags as the assignment and lookup commands so duplicate role names can exist in different scopes.

## Testing

Default workspace tests:

```bash
pnpm -r test -- --run
```

Package-specific tests:

```bash
pnpm --filter @permifyjs/core test -- --run
pnpm --filter @permifyjs/prisma test -- --run
pnpm --filter @permifyjs/mongoose test -- --run
```

Integration tests for Prisma and Mongoose are opt-in because they rely on local database-related prerequisites that are not always available in CI or restricted sandboxes.

Run Prisma integration tests:

```bash
PERMIFYJS_RUN_PRISMA_INTEGRATION=1 pnpm --filter @permifyjs/prisma test -- --run
```

Run Mongoose integration tests:

```bash
PERMIFYJS_RUN_MONGOOSE_INTEGRATION=1 pnpm --filter @permifyjs/mongoose test -- --run
```

See [TESTING.md](/Users/CodeAddictx/Desktop/dev/packages/permifyjs/TESTING.md) for prerequisites, caveats, and contributor commands.

## Release Scope

`v0.0.1` is centered on:

- `core`
- Express and NestJS adapters
- Prisma and Mongoose adapters
- CLI setup and management commands
- `AuthModel`-based authorization

## Local Example

There is an example app in [examples/express-app](/Users/CodeAddictx/Desktop/dev/packages/permifyjs/examples/express-app).

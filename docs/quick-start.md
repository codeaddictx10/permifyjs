# Quick Start

## 1. Pick Your Packages

Install only the packages you need for your stack.

```bash
pnpm add @permifyjs/core
```

Express with Prisma:

```bash
pnpm add @permifyjs/core @permifyjs/express @permifyjs/prisma
```

Express with Mongoose:

```bash
pnpm add @permifyjs/core @permifyjs/express @permifyjs/mongoose
```

NestJS:

```bash
pnpm add @permifyjs/core @permifyjs/nestjs
```

## 2. Create a Resolver

PermifyJS is database agnostic. You either provide the resolver yourself or use one of the database adapters.

```ts
import { createAuth } from '@permifyjs/core';

const resolver = {
  async getRoles(model) {
    return [];
  },
  async getDirectPermissions(model) {
    return [];
  },
  async getPermissionsThroughRoles(model) {
    return [];
  },
  async getRolePermissions(role) {
    return [];
  },
};

const writeResolver = {
  async assignRole(model, role) {},
  async removeRole(model, role) {},
  async syncRoles(model, roles) {},
  async givePermissionTo(model, permission) {},
  async revokePermissionTo(model, permission) {},
  async syncPermissions(model, permissions) {},
  async assignPermissionToRole(role, permission) {},
  async revokePermissionFromRole(role, permission) {},
  async syncRolePermissions(role, permissions) {},
};

export const auth = createAuth({
  resolver,
  writeResolver,
  cache: { ttl: 60, max: 500 },
  beforeCheck: ({ model }) => {
    if (model.isSuperAdmin) return true;
    return null;
  },
});
```

## 3. Use `AuthModel`

PermifyJS authorizes a model, not only a user.

```ts
const user = { id: '1', modelType: 'User' };
const apiClient = { id: 'svc-1', modelType: 'ApiClient' };

await auth.can(user, 'post.edit');
await auth.hasRole(apiClient, 'internal-service');
```

If `modelType` is omitted, it defaults to `"User"`.

## 4. Add a Framework Adapter

### Express

```ts
import express from 'express';
import { createExpressAdapter } from '@permifyjs/express';

const app = express();
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

app.get('/posts', authorize('post.create'), (req, res) => {
  res.json({ ok: true });
});
```

### NestJS

```ts
import { PermifyModule, RequirePermissions } from '@permifyjs/nestjs';

@Module({
  imports: [
    PermifyModule.forRoot({
      auth,
      getUser: (req) => req.user,
      getContext: (req) => ({
        tenantId: req.headers['x-tenant-id'],
        teamId: req.headers['x-team-id'],
      }),
    }),
  ],
})
export class AppModule {}

@Controller('posts')
export class PostsController {
  @Get()
  @RequirePermissions('post.view')
  list() {
    return [];
  }
}
```

## 5. Prisma Setup

```bash
pnpm exec permifyjs init
```

```ts
import { createPrismaResolver, createPrismaWriteResolver } from '@permifyjs/prisma';
import { prisma } from './lib/prisma';

export const auth = createAuth({
  resolver: createPrismaResolver(prisma),
  writeResolver: createPrismaWriteResolver(prisma),
});
```

Run the schema setup through the CLI or use the schema fragment in [packages/core/src/cli/templates/prisma/schema.hbs](/Users/CodeAddictx/Desktop/dev/packages/permifyjs/packages/core/src/cli/templates/prisma/schema.hbs).

`permifyjs init` will ask for your Prisma client import path, so you do not need to keep Prisma in a fixed `../lib/prisma` location.

## 6. Mongoose Setup

```ts
import mongoose from 'mongoose';
import {
  registerPermifyModels,
  createMongooseResolver,
  createMongooseWriteResolver,
} from '@permifyjs/mongoose';

registerPermifyModels();

await mongoose.connect(process.env.MONGODB_URI!);

export const auth = createAuth({
  resolver: createMongooseResolver(),
  writeResolver: createMongooseWriteResolver(),
});
```

## 7. CLI Commands

```bash
pnpm exec permifyjs role:create admin
pnpm exec permifyjs permission:create post.create
pnpm exec permifyjs role:assign --model-id 1 --model-type User --role admin
pnpm exec permifyjs user:permissions --model-id 1 --model-type User
```

## 8. Verify Locally

Default tests:

```bash
pnpm -r test -- --run
```

Opt-in integration tests:

```bash
PERMIFYJS_RUN_PRISMA_INTEGRATION=1 pnpm --filter @permifyjs/prisma test -- --run
PERMIFYJS_RUN_MONGOOSE_INTEGRATION=1 pnpm --filter @permifyjs/mongoose test -- --run
```

See [TESTING.md](/Users/CodeAddictx/Desktop/dev/packages/permifyjs/TESTING.md) for prerequisites and caveats.

## 9. Next Step

Use the example app in [examples/express-app](/Users/CodeAddictx/Desktop/dev/packages/permifyjs/examples/express-app) as the reference integration.

For concrete multitenant patterns, see [docs/team-tenant-patterns.md](/Users/CodeAddictx/Desktop/dev/packages/permifyjs/docs/team-tenant-patterns.md).

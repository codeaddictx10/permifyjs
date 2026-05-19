# @permifyjs/fastify

Fastify adapter for PermifyJS.

## Install

```bash
pnpm add @permifyjs/core @permifyjs/fastify fastify
```

## Usage

```ts
import Fastify from 'fastify';
import { createAuth } from '@permifyjs/core';
import { createFastifyAdapter } from '@permifyjs/fastify';

const auth = createAuth({ resolver, writeResolver });
const app = Fastify();

const { authorize, authorizeRole } = createFastifyAdapter(auth, {
  getUser: (request) => request.user,
  getContext: (request) => ({
    tenantId: request.headers['x-tenant-id'] as string,
  }),
});

app.get('/posts', { preHandler: authorize('post.view') }, async () => {
  return { ok: true };
});
```

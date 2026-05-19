# @permifyjs/typeorm

TypeORM adapter for PermifyJS.

## Install

```bash
pnpm add @permifyjs/core @permifyjs/typeorm typeorm
```

## Usage

```ts
import { createAuth } from '@permifyjs/core';
import {
  createTypeOrmResolver,
  createTypeOrmWriteResolver,
  syncPermifySchema,
} from '@permifyjs/typeorm';
import { dataSource } from './db/data-source';

await dataSource.initialize();
await syncPermifySchema(dataSource);

const auth = createAuth({
  resolver: createTypeOrmResolver(dataSource),
  writeResolver: createTypeOrmWriteResolver(dataSource),
});
```

## Scope Support

The adapter supports the same `scopeMode` values as the Prisma and Mongoose adapters:

- `global`
- `tenant`
- `team`
- `tenant-team`

## Schema Management

Use the exported helpers to manage the adapter tables:

- `syncPermifySchema()`
- `dropPermifySchema()`
- `getPermifySchemaStatus()`

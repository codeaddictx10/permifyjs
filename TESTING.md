# Testing

This repo uses a small default test path and a separate opt-in integration path.

## Default Test Suite

Run the full workspace suite:

```bash
pnpm -r test -- --run
```

Run package-level suites:

```bash
pnpm --filter @permifyjs/core test -- --run
pnpm --filter @permifyjs/express test -- --run
pnpm --filter @permifyjs/nestjs test -- --run
pnpm --filter @permifyjs/prisma test -- --run
pnpm --filter @permifyjs/mongoose test -- --run
```

The default suite is expected to pass without provisioning a live database.

## Opt-In Integration Tests

Two packages include gated integration tests:

- `@permifyjs/prisma`
- `@permifyjs/mongoose`

These tests are skipped unless you explicitly enable them with environment variables.

### Prisma Integration

Command:

```bash
PERMIFYJS_RUN_PRISMA_INTEGRATION=1 pnpm --filter @permifyjs/prisma test -- --run
```

What it does:

- generates a temporary Prisma client
- creates a temporary SQLite-backed database
- verifies role and permission reads and writes against the Prisma adapter

Prerequisites:

- `pnpm` installed
- package dependencies installed
- working native support for `@prisma/adapter-better-sqlite3`

Notes:

- the test lives in [packages/prisma/src/__tests__/integration.test.ts](/Users/CodeAddictx/Desktop/dev/packages/permifyjs/packages/prisma/src/__tests__/integration.test.ts)
- if native bindings fail to build on your machine, reinstall dependencies and rebuild the Prisma package dependencies before retrying

### Mongoose Integration

Command:

```bash
PERMIFYJS_RUN_MONGOOSE_INTEGRATION=1 pnpm --filter @permifyjs/mongoose test -- --run
```

What it does:

- starts `mongodb-memory-server`
- opens a local MongoDB listener
- verifies role and permission reads and writes against the Mongoose adapter

Prerequisites:

- `pnpm` installed
- package dependencies installed
- an environment that allows local listener startup

Notes:

- the test lives in [packages/mongoose/src/__tests__/integration.test.ts](/Users/CodeAddictx/Desktop/dev/packages/permifyjs/packages/mongoose/src/__tests__/integration.test.ts)
- restricted sandboxes may block local port binding, which will cause this test to fail even if the code is correct

## CLI Coverage

Current CLI generation coverage includes Prisma client import path handling:

- [packages/core/src/__tests__/cli-init.test.ts](/Users/CodeAddictx/Desktop/dev/packages/permifyjs/packages/core/src/__tests__/cli-init.test.ts)

Run it with:

```bash
pnpm --filter @permifyjs/core test -- --run
```

## Contributor Workflow

Recommended order before opening a change:

1. Run `pnpm -r test -- --run`.
2. Run the package-specific suite for the area you changed.
3. If you touched Prisma or Mongoose adapter behavior, run the matching opt-in integration test.
4. If you touched CLI scaffolding, verify the generated files in a temp app flow.

## Troubleshooting

If a Prisma integration test fails:

- verify that dependencies are installed
- verify that `@prisma/adapter-better-sqlite3` built correctly on your machine
- rerun only the Prisma package test to isolate the failure

If a Mongoose integration test fails:

- verify that your environment allows local listener startup
- rerun only the Mongoose package test to isolate the failure
- check whether the failure is infrastructure-related before changing adapter code

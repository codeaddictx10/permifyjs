# Express Prisma Example

This example is the live Express app wired into the `permifyjs` workspace packages. It uses Prisma 7 with SQLite and the local `@permifyjs/core`, `@permifyjs/express`, and `@permifyjs/prisma` packages via `workspace:*`.

## Install

From the monorepo root:

```bash
pnpm install
```

## Prepare Prisma

```bash
pnpm --filter express-prisma-example prisma:generate
pnpm --filter express-prisma-example prisma:push
```

## Run

```bash
pnpm --filter express-prisma-example dev
```

## Routes

Headers used by the auth adapter:

- `x-user-id`
- `x-team-id`

Read users:

```bash
curl http://localhost:3000/users \
  -H 'x-user-id: 1' \
  -H 'x-team-id: global'
```

Create a user:

```bash
curl -X POST http://localhost:3000/users \
  -H 'content-type: application/json' \
  -H 'x-user-id: 1' \
  -H 'x-team-id: global' \
  -d '{"email":"new@example.com","name":"New User"}'
```

Health route:

```bash
curl http://localhost:3000/ \
  -H 'x-user-id: 1' \
  -H 'x-team-id: global'
```

## Active Package Development

Because this app lives inside the monorepo and depends on the Permify packages through workspace links, changes you make in `packages/core`, `packages/express`, or `packages/prisma` are the versions this app will exercise after those packages rebuild.

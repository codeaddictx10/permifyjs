# Express Example

This example shows how to scope authorization with `tenantId` and `teamId` using the current PermifyJS API.

## Headers Used

- `x-user-id`
- `x-tenant-id`
- `x-team-id`
- `x-super-admin`

## Run

```bash
pnpm --dir examples/express-app dev
```

## Try Team-Scoped Access

User `1` is a `team-admin` in tenant `acme`, team `design`.

```bash
curl http://localhost:3000/members/invite \
  -H 'x-user-id: 1' \
  -H 'x-tenant-id: acme' \
  -H 'x-team-id: design'
```

The same user is only a `team-viewer` in `acme/support`, so create access changes with the context:

```bash
curl http://localhost:3000/teams/support/posts \
  -H 'x-user-id: 1' \
  -H 'x-tenant-id: acme'
```

## Try Tenant-Scoped Access

User `1` has direct `billing.view` permission only in tenant `acme`.

```bash
curl http://localhost:3000/billing \
  -H 'x-user-id: 1' \
  -H 'x-tenant-id: acme'
```

This should fail for a different tenant unless you assign the permission there too.

## Try Mixed Tenant + Team Scope

The route below shows the evaluated scope and a few checks together:

```bash
curl http://localhost:3000/teams/design/posts \
  -H 'x-user-id: 1' \
  -H 'x-tenant-id: acme'
```

## Important Pattern

Reads and writes must use the same scope.

If you assign a role with:

```bash
curl -X POST http://localhost:3000/users/2/roles \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: acme' \
  -H 'x-team-id: design' \
  -d '{"role":"team-admin"}'
```

then the matching checks must also pass `tenantId=acme` and `teamId=design`.

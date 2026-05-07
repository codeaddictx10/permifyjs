---
"@permifyjs/mongoose": major
"@permifyjs/prisma": major
"@permifyjs/core": major
"express-app-tenant-aware": minor
"express-prisma-example": patch
---

Add multi-scope mode across core and adapters.

This is a breaking change for `@permifyjs/core`, `@permifyjs/prisma`, and `@permifyjs/mongoose` because scope handling is now explicit and normalized around `scopeMode`. Tenant and team fields are no longer assumed to be present or automatically applied in every case; instead, `tenantId` and `teamId` are only included when the selected scope mode enables them. Prisma and Mongoose resolvers, write resolvers, generated templates, and emitted schemas now use this scoped behavior.

The change was made to support global, tenant, and team-aware authorization flows consistently across the core package, adapters, CLI output, and generated schemas. It removes earlier implicit assumptions about scope fields, makes scoping behavior predictable, and allows consumers to model applications that are global-only or selectively tenant/team scoped without carrying unused fields.

To update, consumers should review any resolver or write resolver setup and pass the appropriate `scopeMode` for their application, regenerate or update any generated templates and schemas, and make sure their Prisma or Mongoose models only include the scope fields required by the selected mode. If your existing code assumed `tenantId` or `teamId` were always available, update that logic to align with the new scoped behavior before upgrading.

- Introduce `ScopeMode` type and defaults for global and scoped behavior
- Normalize scope and apply `tenantId`/`teamId` only when enabled by `scopeMode`
- Extend Prisma and Mongoose resolvers/write resolvers to accept `scopeMode` and use scoped keys
- Update templates and schemas to emit `scopeMode` and include `tenantId`/`teamId` as needed
- Improve CLI scope utilities and tests for global, tenant, and team behaviors
- Add tenant-aware example app (`express-app-tenant-aware`) with config, Prisma schema, migrations, and sample endpoints

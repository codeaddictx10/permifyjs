import { defineConfig } from "@permifyjs/core";

export default defineConfig({
  adapter: "prisma",
  framework: "express",
  models: ["User"],
  cache: {
    ttl: 60,
    max: 500,
  },
  tables: {
    roles: "roles",
    permissions: "permissions",
    roleHasPermissions: "role_has_permissions",
    modelHasRoles: "model_has_roles",
    modelHasPermissions: "model_has_permissions",
  },
});

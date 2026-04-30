"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AUTH_ENGINE: () => AUTH_ENGINE,
  PERMISSIONS_KEY: () => PERMISSIONS_KEY,
  PermifyGuard: () => PermifyGuard,
  PermifyModule: () => PermifyModule,
  ROLES_KEY: () => ROLES_KEY,
  RequirePermissions: () => RequirePermissions,
  RequireRoles: () => RequireRoles
});
module.exports = __toCommonJS(index_exports);

// src/auth.guard.ts
var import_common2 = require("@nestjs/common");

// src/permissions.decorator.ts
var import_common = require("@nestjs/common");
var PERMISSIONS_KEY = "permissions";
var ROLES_KEY = "roles";
var RequirePermissions = (...permissions) => (0, import_common.SetMetadata)(PERMISSIONS_KEY, permissions);
var RequireRoles = (...roles) => (0, import_common.SetMetadata)(ROLES_KEY, roles);

// src/auth.guard.ts
var AUTH_ENGINE = "PERMIFY_AUTH_ENGINE";
var PermifyGuard = class {
  constructor(reflector, auth, opts) {
    this.reflector = reflector;
    this.auth = auth;
    this.opts = opts;
  }
  async canActivate(context) {
    const permissions = this.reflector.getAllAndOverride(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );
    const roles = this.reflector.getAllAndOverride(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!permissions?.length && !roles?.length) return true;
    const req = context.switchToHttp().getRequest();
    const user = this.opts.getUser(req);
    const authContext = this.opts.getContext?.(req);
    if (permissions?.length) {
      const results = await Promise.all(
        permissions.map((p) => this.auth.can(user, p, authContext))
      );
      if (!results.every(Boolean)) throw new import_common2.ForbiddenException();
    }
    if (roles?.length) {
      const results = await Promise.all(
        roles.map((r) => this.auth.hasRole(user, r, authContext))
      );
      if (!results.every(Boolean)) throw new import_common2.ForbiddenException();
    }
    return true;
  }
};
PermifyGuard = __decorateClass([
  (0, import_common2.Injectable)(),
  __decorateParam(1, (0, import_common2.Inject)(AUTH_ENGINE)),
  __decorateParam(2, (0, import_common2.Inject)("PERMIFY_OPTIONS"))
], PermifyGuard);

// src/auth.module.ts
var import_common3 = require("@nestjs/common");
var import_core = require("@nestjs/core");
var PermifyModule = class {
  static forRoot(options) {
    return {
      module: PermifyModule,
      global: true,
      providers: [
        {
          provide: AUTH_ENGINE,
          useValue: options.auth
        },
        {
          provide: "PERMIFY_OPTIONS",
          useValue: {
            getUser: options.getUser,
            getContext: options.getContext
          }
        },
        import_core.Reflector,
        PermifyGuard
      ],
      exports: [PermifyGuard, AUTH_ENGINE]
    };
  }
};
PermifyModule = __decorateClass([
  (0, import_common3.Module)({})
], PermifyModule);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AUTH_ENGINE,
  PERMISSIONS_KEY,
  PermifyGuard,
  PermifyModule,
  ROLES_KEY,
  RequirePermissions,
  RequireRoles
});

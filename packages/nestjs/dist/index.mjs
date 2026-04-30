var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);

// src/auth.guard.ts
import {
  Inject,
  Injectable,
  ForbiddenException
} from "@nestjs/common";

// src/permissions.decorator.ts
import { SetMetadata } from "@nestjs/common";
var PERMISSIONS_KEY = "permissions";
var ROLES_KEY = "roles";
var RequirePermissions = (...permissions) => SetMetadata(PERMISSIONS_KEY, permissions);
var RequireRoles = (...roles) => SetMetadata(ROLES_KEY, roles);

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
      if (!results.every(Boolean)) throw new ForbiddenException();
    }
    if (roles?.length) {
      const results = await Promise.all(
        roles.map((r) => this.auth.hasRole(user, r, authContext))
      );
      if (!results.every(Boolean)) throw new ForbiddenException();
    }
    return true;
  }
};
PermifyGuard = __decorateClass([
  Injectable(),
  __decorateParam(1, Inject(AUTH_ENGINE)),
  __decorateParam(2, Inject("PERMIFY_OPTIONS"))
], PermifyGuard);

// src/auth.module.ts
import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
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
        Reflector,
        PermifyGuard
      ],
      exports: [PermifyGuard, AUTH_ENGINE]
    };
  }
};
PermifyModule = __decorateClass([
  Module({})
], PermifyModule);
export {
  AUTH_ENGINE,
  PERMISSIONS_KEY,
  PermifyGuard,
  PermifyModule,
  ROLES_KEY,
  RequirePermissions,
  RequireRoles
};

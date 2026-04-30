import * as _nestjs_common from '@nestjs/common';
import { CanActivate, ExecutionContext, DynamicModule } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser, AuthContext, AuthEngine } from '@permifyjs/core';

declare const AUTH_ENGINE = "PERMIFY_AUTH_ENGINE";
interface NestAdapterOptions {
    getUser: (req: any) => AuthUser;
    getContext?: (req: any) => AuthContext;
}
declare class PermifyGuard implements CanActivate {
    private reflector;
    private auth;
    private opts;
    constructor(reflector: Reflector, auth: AuthEngine, opts: NestAdapterOptions);
    canActivate(context: ExecutionContext): Promise<boolean>;
}

interface PermifyModuleOptions extends NestAdapterOptions {
    auth: AuthEngine;
}
declare class PermifyModule {
    static forRoot(options: PermifyModuleOptions): DynamicModule;
}

declare const PERMISSIONS_KEY = "permissions";
declare const ROLES_KEY = "roles";
declare const RequirePermissions: (...permissions: string[]) => _nestjs_common.CustomDecorator<string>;
declare const RequireRoles: (...roles: string[]) => _nestjs_common.CustomDecorator<string>;

export { AUTH_ENGINE, type NestAdapterOptions, PERMISSIONS_KEY, PermifyGuard, PermifyModule, type PermifyModuleOptions, ROLES_KEY, RequirePermissions, RequireRoles };

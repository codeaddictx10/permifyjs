import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthEngine, AuthUser, AuthContext } from '@permifyjs/core';
import { PERMISSIONS_KEY, ROLES_KEY } from './permissions.decorator';

export const AUTH_ENGINE = 'PERMIFY_AUTH_ENGINE';

export interface NestAdapterOptions {
  getUser: (req: any) => AuthUser;
  getContext?: (req: any) => AuthContext;
}

@Injectable()
export class PermifyGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(AUTH_ENGINE) private auth: AuthEngine,
    @Inject('PERMIFY_OPTIONS') private opts: NestAdapterOptions
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No decorators applied — allow through
    if (!permissions?.length && !roles?.length) return true;

    const req = context.switchToHttp().getRequest();
    const user = this.opts.getUser(req);
    const authContext = this.opts.getContext?.(req);

    // Check permissions
    if (permissions?.length) {
      const results = await Promise.all(
        permissions.map((p) => this.auth.can(user, p, authContext))
      );
      if (!results.every(Boolean)) throw new ForbiddenException();
    }

    // Check roles
    if (roles?.length) {
      const results = await Promise.all(
        roles.map((r) => this.auth.hasRole(user, r, authContext))
      );
      if (!results.every(Boolean)) throw new ForbiddenException();
    }

    return true;
  }
}

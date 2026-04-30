import type { Request, Response, NextFunction } from 'express';
import type { AuthEngine } from '@permifyjs/core';
import type { ExpressAdapterOptions } from './types';

export function createExpressAdapter(
  auth: AuthEngine,
  opts: ExpressAdapterOptions
) {
  return {
    authorize(permission: string) {
      return async (req: Request, res: Response, next: NextFunction) => {
        try {
          const user = opts.getUser(req);
          const context = opts.getContext?.(req);
          const allowed = await auth.can(user, permission, context);

          if (!allowed) {
            return res.status(403).json({ error: 'Forbidden' });
          }

          next();
        } catch (err) {
          next(err);
        }
      };
    },

    authorizeRole(role: string) {
      return async (req: Request, res: Response, next: NextFunction) => {
        try {
          const user = opts.getUser(req);
          const context = opts.getContext?.(req);
          const allowed = await auth.hasRole(user, role, context);

          if (!allowed) {
            return res.status(403).json({ error: 'Forbidden' });
          }

          next();
        } catch (err) {
          next(err);
        }
      };
    },
  };
}

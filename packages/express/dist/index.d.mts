import { Request, Response, NextFunction } from 'express';
import { AuthUser, AuthContext, AuthEngine } from '@permifyjs/core';

interface ExpressAdapterOptions {
    getUser: (req: Request) => AuthUser;
    getContext?: (req: Request) => AuthContext;
}

declare function createExpressAdapter(auth: AuthEngine, opts: ExpressAdapterOptions): {
    authorize(permission: string): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    authorizeRole(role: string): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
};

export { type ExpressAdapterOptions, createExpressAdapter };

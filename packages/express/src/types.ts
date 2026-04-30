import type { Request } from 'express';
import type { AuthUser, AuthContext } from '@permifyjs/core';

export interface ExpressAdapterOptions {
  getUser: (req: Request) => AuthUser;
  getContext?: (req: Request) => AuthContext;
}

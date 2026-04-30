import { Module, DynamicModule } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthEngine } from '@permifyjs/core';
import { PermifyGuard, AUTH_ENGINE, NestAdapterOptions } from './auth.guard';

export interface PermifyModuleOptions extends NestAdapterOptions {
  auth: AuthEngine;
}

@Module({})
export class PermifyModule {
  static forRoot(options: PermifyModuleOptions): DynamicModule {
    return {
      module: PermifyModule,
      global: true,
      providers: [
        {
          provide: AUTH_ENGINE,
          useValue: options.auth,
        },
        {
          provide: 'PERMIFY_OPTIONS',
          useValue: {
            getUser: options.getUser,
            getContext: options.getContext,
          },
        },
        Reflector,
        PermifyGuard,
      ],
      exports: [PermifyGuard, AUTH_ENGINE],
    };
  }
}

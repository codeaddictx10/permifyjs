import { createAuth } from '@permifyjs/core';
import { resolver } from './resolver';
import { writeResolver } from './writeResolver';

export const auth = createAuth({
  resolver,
  writeResolver,
  cache: {
    ttl: 60,
    max: 500,
  },
});

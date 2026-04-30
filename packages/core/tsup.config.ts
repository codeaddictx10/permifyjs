import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    outDir: 'dist',
  },
  {
    entry: ['src/cli/bin.ts'],
    format: ['cjs'],
    dts: false,
    clean: false,
    outDir: 'dist',
    outExtension: () => ({ js: '.js' }),
    banner: {
      js: '#!/usr/bin/env node',
    },
    noExternal: [
      'commander',
      'chalk',
      'ora',
      'prompts',
      'handlebars',
      'execa',
      'fs-extra',
    ],
  },
]);

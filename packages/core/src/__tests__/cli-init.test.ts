import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const tempDirs: string[] = [];
const originalCwd = process.cwd();

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'permifyjs-init-'));
  tempDirs.push(dir);
  return dir;
}

const promptsMock = vi.fn();
const installPackagesMock = vi.fn();
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

vi.mock('prompts', () => ({
  default: promptsMock,
}));

vi.mock('../cli/utils/installer', () => ({
  installPackages: installPackagesMock,
}));

describe('runInit()', () => {
  beforeEach(() => {
    promptsMock.mockReset();
    installPackagesMock.mockReset();
    consoleLogSpy.mockClear();
  });

  afterEach(() => {
    process.chdir(originalCwd);

    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  it('uses the provided prisma client import path in generated files', async () => {
    const cwd = createTempDir();
    mkdirSync(join(cwd, 'src', 'db'), { recursive: true });
    mkdirSync(join(cwd, 'prisma'), { recursive: true });

    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'test-app' }));
    writeFileSync(join(cwd, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }));
    writeFileSync(join(cwd, 'src/db/client.ts'), 'export const prisma = {};');
    writeFileSync(
      join(cwd, 'prisma/schema.prisma'),
      'generator client { provider = "prisma-client-js" }\ndatasource db { provider = "sqlite" url = env("DATABASE_URL") }'
    );

    promptsMock.mockResolvedValue({
      adapter: 'prisma',
      framework: 'express',
      models: ['User'],
      scopeMode: 'global',
      enableCache: true,
      prismaClientImportPath: '../db/client',
      confirm: true,
    });

    installPackagesMock.mockResolvedValue(undefined);
    process.chdir(cwd);

    vi.resetModules();
    const { runInit } = await import('../cli/commands/init');
    await runInit();

    expect(installPackagesMock).toHaveBeenCalledWith(
      ['@permifyjs/core', '@permifyjs/express', '@permifyjs/prisma'],
      'npm'
    );

    expect(readFileSync(join(cwd, 'permifyjs.config.ts'), 'utf-8')).toContain(
      "adapter: 'prisma'"
    );
    expect(readFileSync(join(cwd, 'permifyjs.config.ts'), 'utf-8')).toContain(
      "scopeMode: 'global'"
    );
    expect(readFileSync(join(cwd, 'src/permifyjs/index.ts'), 'utf-8')).toContain(
      'export const auth = createAuth({'
    );
    expect(readFileSync(join(cwd, 'permifyjs.config.ts'), 'utf-8')).toContain(
      'cache: {'
    );
    expect(readFileSync(join(cwd, 'src/permifyjs/index.ts'), 'utf-8')).toContain(
      'cache: {'
    );

    const resolverContents = readFileSync(
      join(cwd, 'src/permifyjs/resolver.ts'),
      'utf-8'
    );
    const writeResolverContents = readFileSync(
      join(cwd, 'src/permifyjs/writeResolver.ts'),
      'utf-8'
    );

    expect(resolverContents).toContain(`import config from '../../permifyjs.config';`);
    expect(resolverContents).toContain(`import { prisma } from '../db/client';`);
    expect(resolverContents).toContain('scopeMode: config.scopeMode');
    expect(writeResolverContents).toContain(
      `import { prisma } from '../db/client';`
    );
    expect(writeResolverContents).toContain('scopeMode: config.scopeMode');
    expect(readFileSync(join(cwd, 'prisma/schema.prisma'), 'utf-8')).toContain(
      'model PermifyRole'
    );
    expect(readFileSync(join(cwd, 'prisma/schema.prisma'), 'utf-8')).not.toContain(
      'tenantId'
    );
    expect(readFileSync(join(cwd, 'prisma/schema.prisma'), 'utf-8')).not.toContain(
      'teamId'
    );
  });

  it('bootstraps mongoose projects with generated registerModels helper', async () => {
    const cwd = createTempDir();
    mkdirSync(join(cwd, 'src'), { recursive: true });

    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        dependencies: {
          mongoose: '^8.0.0',
          '@nestjs/core': '^11.0.0',
        },
      })
    );
    writeFileSync(join(cwd, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }));

    promptsMock.mockResolvedValue({
      adapter: 'mongoose',
      framework: 'nestjs',
      models: ['User', 'Team'],
      scopeMode: 'global',
      enableCache: false,
      confirm: true,
    });

    installPackagesMock.mockResolvedValue(undefined);
    process.chdir(cwd);

    vi.resetModules();
    const { runInit } = await import('../cli/commands/init');
    await runInit();

    expect(installPackagesMock).toHaveBeenCalledWith(
      ['@permifyjs/core', '@permifyjs/nestjs', '@permifyjs/mongoose'],
      'npm'
    );

    expect(readFileSync(join(cwd, 'permifyjs.config.ts'), 'utf-8')).toContain(
      "framework: 'nestjs'"
    );
    expect(readFileSync(join(cwd, 'permifyjs.config.ts'), 'utf-8')).toContain(
      "models: ['User', 'Team']"
    );
    expect(readFileSync(join(cwd, 'permifyjs.config.ts'), 'utf-8')).toContain(
      "scopeMode: 'global'"
    );
    expect(readFileSync(join(cwd, 'permifyjs.config.ts'), 'utf-8')).not.toContain(
      'cache: {'
    );
    expect(readFileSync(join(cwd, 'src/permifyjs/index.ts'), 'utf-8')).not.toContain(
      'cache: {'
    );
    expect(
      readFileSync(join(cwd, 'src/permifyjs/registerModels.ts'), 'utf-8')
    ).toContain("registerPermifyModels({ scopeMode: config.scopeMode });");
  });

  it('generates tenant-only prisma schema and resolver config wiring when requested', async () => {
    const cwd = createTempDir();
    mkdirSync(join(cwd, 'src', 'db'), { recursive: true });
    mkdirSync(join(cwd, 'prisma'), { recursive: true });

    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'test-app' }));
    writeFileSync(join(cwd, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }));
    writeFileSync(join(cwd, 'src/db/client.ts'), 'export const prisma = {};');
    writeFileSync(
      join(cwd, 'prisma/schema.prisma'),
      'generator client { provider = "prisma-client-js" }\ndatasource db { provider = "sqlite" url = env("DATABASE_URL") }'
    );

    promptsMock.mockResolvedValue({
      adapter: 'prisma',
      framework: 'express',
      models: ['User'],
      scopeMode: 'tenant',
      enableCache: false,
      prismaClientImportPath: '../db/client',
      confirm: true,
    });

    installPackagesMock.mockResolvedValue(undefined);
    process.chdir(cwd);

    vi.resetModules();
    const { runInit } = await import('../cli/commands/init');
    await runInit();

    const configContents = readFileSync(join(cwd, 'permifyjs.config.ts'), 'utf-8');
    const schemaContents = readFileSync(join(cwd, 'prisma/schema.prisma'), 'utf-8');

    expect(configContents).toContain("scopeMode: 'tenant'");
    expect(schemaContents).toContain('tenantId');
    expect(schemaContents).not.toContain('teamId');
    expect(schemaContents).toContain('@@id([roleId, permissionId, tenantId])');
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  detectInstalledAdapter,
  detectPrisma,
  detectPrismaClientImportPath,
  detectPrismaSchemaPath,
} from '../cli/utils/detect';

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'permifyjs-detect-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('detectPrismaSchemaPath()', () => {
  it('prefers the schema path declared in package.json', () => {
    const cwd = createTempDir();
    mkdirSync(join(cwd, 'db'), { recursive: true });
    mkdirSync(join(cwd, 'prisma'), { recursive: true });
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({ prisma: { schema: 'db/custom.prisma' } }, null, 2)
    );
    writeFileSync(join(cwd, 'db/custom.prisma'), 'datasource db {}');
    writeFileSync(join(cwd, 'prisma/schema.prisma'), 'datasource db {}');

    expect(detectPrismaSchemaPath(cwd)).toBe(join(cwd, 'db/custom.prisma'));
  });

  it('detects common schema locations', () => {
    const cwd = createTempDir();
    mkdirSync(join(cwd, 'prisma'), { recursive: true });
    writeFileSync(join(cwd, 'prisma/schema.prisma'), 'datasource db {}');

    expect(detectPrismaSchemaPath(cwd)).toBe(join(cwd, 'prisma/schema.prisma'));
    expect(detectPrisma(cwd)).toBe(true);
    expect(detectInstalledAdapter(cwd)).toBe('prisma');
  });

  it('falls back to nested schema discovery for monorepo-style layouts', () => {
    const cwd = createTempDir();
    mkdirSync(join(cwd, 'apps/api/prisma'), { recursive: true });
    writeFileSync(join(cwd, 'apps/api/prisma/schema.prisma'), 'datasource db {}');

    expect(detectPrismaSchemaPath(cwd)).toBe(
      join(cwd, 'apps/api/prisma/schema.prisma')
    );
  });
});

describe('detectPrismaClientImportPath()', () => {
  it('detects a prisma client in src/lib and returns a relative import specifier', () => {
    const cwd = createTempDir();
    mkdirSync(join(cwd, 'src/lib'), { recursive: true });
    writeFileSync(join(cwd, 'src/lib/prisma.ts'), 'export const prisma = {};');

    expect(detectPrismaClientImportPath('src', cwd)).toBe('../lib/prisma');
  });

  it('detects index-based prisma client modules', () => {
    const cwd = createTempDir();
    mkdirSync(join(cwd, 'src/db/prisma'), { recursive: true });
    writeFileSync(join(cwd, 'src/db/prisma/index.ts'), 'export const prisma = {};');

    expect(detectPrismaClientImportPath('src', cwd)).toBe('../db/prisma');
  });
});

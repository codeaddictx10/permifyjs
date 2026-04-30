import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, extname, join, relative } from 'path';
import process from 'process';

export type PackageManager = 'pnpm' | 'yarn' | 'npm';

const COMMON_PRISMA_PATHS = [
  'prisma/schema.prisma',
  'schema.prisma',
  'db/schema.prisma',
  'database/schema.prisma',
  'src/prisma/schema.prisma',
  'src/schema.prisma',
] as const;

const SUPPORTED_SOURCE_EXTENSIONS = ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'] as const;

const SKIPPED_SEARCH_DIRS = new Set([
  '.git',
  '.next',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
]);

function readPackageJson(cwd: string): Record<string, any> | null {
  const packageJsonPath = join(cwd, 'package.json');
  if (!existsSync(packageJsonPath)) return null;

  try {
    return JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  } catch {
    return null;
  }
}

function packageHasDependency(cwd: string, pkg: string): boolean {
  const packageJson = readPackageJson(cwd);
  if (!packageJson) return false;

  return Boolean(
    packageJson.dependencies?.[pkg] ||
    packageJson.devDependencies?.[pkg] ||
    packageJson.peerDependencies?.[pkg] ||
    packageJson.optionalDependencies?.[pkg]
  );
}

function getPackageJsonPrismaSchemaPath(cwd: string): string | null {
  const packageJson = readPackageJson(cwd);
  const schemaPath = packageJson?.prisma?.schema;

  if (typeof schemaPath !== 'string' || schemaPath.trim() === '') {
    return null;
  }

  const absolutePath = join(cwd, schemaPath);
  return existsSync(absolutePath) ? absolutePath : null;
}

function findNestedPrismaSchema(cwd: string, maxDepth = 4): string | null {
  const visit = (dir: string, depth: number): string | null => {
    if (depth > maxDepth) return null;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIPPED_SEARCH_DIRS.has(entry.name)) continue;
        const nested = visit(join(dir, entry.name), depth + 1);
        if (nested) return nested;
      }

      if (entry.isFile() && entry.name === 'schema.prisma') {
        return join(dir, entry.name);
      }
    }

    return null;
  };

  return visit(cwd, 0);
}

function toImportSpecifier(fromDir: string, filePath: string): string {
  const extension = extname(filePath);
  const withoutExtension = extension ? filePath.slice(0, -extension.length) : filePath;
  const withoutIndex = withoutExtension.endsWith('/index')
    ? dirname(withoutExtension)
    : withoutExtension;

  let specifier = relative(fromDir, withoutIndex).replace(/\\/g, '/');
  if (!specifier.startsWith('.')) {
    specifier = `./${specifier}`;
  }

  return specifier;
}

export function detectPrismaClientImportPath(
  srcDir = detectSrcDir(),
  cwd = process.cwd()
): string | null {
  const sourceRoot = srcDir === '.' ? '' : `${srcDir}/`;
  const candidateBases = [
    `${sourceRoot}lib/prisma`,
    `${sourceRoot}db/prisma`,
    `${sourceRoot}prisma`,
    'lib/prisma',
    'db/prisma',
    'prisma',
  ];

  const permifyDir = join(cwd, srcDir, 'permifyjs');

  for (const base of candidateBases) {
    for (const extension of SUPPORTED_SOURCE_EXTENSIONS) {
      const candidate = join(cwd, `${base}${extension}`);
      if (existsSync(candidate)) {
        return toImportSpecifier(permifyDir, candidate);
      }
    }

    for (const extension of SUPPORTED_SOURCE_EXTENSIONS) {
      const candidate = join(cwd, base, `index${extension}`);
      if (existsSync(candidate)) {
        return toImportSpecifier(permifyDir, candidate);
      }
    }
  }

  return null;
}

export function detectPackageManager(cwd = process.cwd()): PackageManager {
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

export function detectTypeScript(cwd = process.cwd()): boolean {
  return existsSync(join(cwd, 'tsconfig.json'));
}

export function detectPrisma(cwd = process.cwd()): boolean {
  return detectPrismaSchemaPath(cwd) !== null || packageHasDependency(cwd, 'prisma');
}

export function detectPrismaSchemaPath(cwd = process.cwd()): string | null {
  const packageJsonSchemaPath = getPackageJsonPrismaSchemaPath(cwd);
  if (packageJsonSchemaPath) return packageJsonSchemaPath;

  for (const relativePath of COMMON_PRISMA_PATHS) {
    const absolutePath = join(cwd, relativePath);
    if (existsSync(absolutePath)) return absolutePath;
  }

  return findNestedPrismaSchema(cwd);
}

export function detectMongoose(cwd = process.cwd()): boolean {
  if (packageHasDependency(cwd, 'mongoose')) return true;

  try {
    require.resolve('mongoose');
    return true;
  } catch {
    return false;
  }
}

export function detectTypeORM(cwd = process.cwd()): boolean {
  if (packageHasDependency(cwd, 'typeorm')) return true;

  try {
    require.resolve('typeorm');
    return true;
  } catch {
    return false;
  }
}

export function detectInstalledAdapter(
  cwd = process.cwd()
): 'prisma' | 'mongoose' | 'typeorm' | null {
  if (detectPrisma(cwd)) return 'prisma';
  if (detectMongoose(cwd)) return 'mongoose';
  if (detectTypeORM(cwd)) return 'typeorm';
  return null;
}

export function detectInstalledFramework(
  cwd = process.cwd()
): 'express' | 'nestjs' | 'fastify' | null {
  const checks: Array<['express' | 'nestjs' | 'fastify', string]> = [
    ['nestjs', '@nestjs/core'],
    ['fastify', 'fastify'],
    ['express', 'express'],
  ];

  for (const [framework, pkg] of checks) {
    if (packageHasDependency(cwd, pkg)) {
      return framework;
    }

    try {
      require.resolve(pkg);
      return framework;
    } catch {
      continue;
    }
  }

  return null;
}

export function detectSrcDir(cwd = process.cwd()): string {
  return existsSync(join(cwd, 'src')) ? 'src' : '.';
}

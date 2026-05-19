import { existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, extname, join, resolve } from 'path';
import { detectSrcDir } from './detect';

const MODULE_EXTENSIONS = ['.ts', '.js', '.cts', '.cjs'] as const;
const DEFAULT_ENV_FILES = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
] as const;

let loadedEnvCwds = new Set<string>();

export function getProjectRequire(cwd = process.cwd()): NodeRequire {
  const packageJsonPath = join(cwd, 'package.json');
  const basePath = existsSync(packageJsonPath)
    ? packageJsonPath
    : join(cwd, 'index.js');

  return createRequire(basePath);
}

function findFile(basePath: string): string | null {
  for (const extension of MODULE_EXTENSIONS) {
    const candidate = `${basePath}${extension}`;
    if (existsSync(candidate)) return candidate;
  }

  for (const extension of MODULE_EXTENSIONS) {
    const candidate = join(basePath, `index${extension}`);
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function registerTypeScriptHook(projectRequire: NodeRequire): (() => void) | null {
  const extensions = projectRequire.extensions as Record<string, any>;

  if (extensions['.ts']) {
    return null;
  }

  let ts: typeof import('typescript');

  try {
    ts = projectRequire('typescript') as typeof import('typescript');
  } catch {
    try {
      ts = require('typescript') as typeof import('typescript');
    } catch {
      throw new Error(
        '[permifyjs] Loading TypeScript permify modules requires "typescript" to be installed in the project or available from @permifyjs/core'
      );
    }
  }

  const previous = new Map<string, any>();
  const handledExtensions = ['.ts', '.cts'];

  for (const extension of handledExtensions) {
    previous.set(extension, extensions[extension]);
    extensions[extension] = (mod: { _compile(code: string, filename: string): void }, filename: string) => {
      const source = readFileSync(filename, 'utf-8');
      const output = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          moduleResolution: ts.ModuleResolutionKind.NodeJs,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
        },
        fileName: filename,
      });

      mod._compile(output.outputText, filename);
    };
  }

  return () => {
    for (const [extension, handler] of previous.entries()) {
      if (handler) {
        extensions[extension] = handler;
      } else {
        delete extensions[extension];
      }
    }
  };
}

function loadCommonJsModule<T = any>(modulePath: string, cwd = process.cwd()): T {
  loadProjectEnv(cwd);

  const projectRequire = getProjectRequire(cwd);
  const restoreTypeScriptHook =
    extname(modulePath) === '.ts' || extname(modulePath) === '.cts'
      ? registerTypeScriptHook(projectRequire)
      : null;

  try {
    return projectRequire(modulePath) as T;
  } finally {
    restoreTypeScriptHook?.();
  }
}

export function findProjectPermifyModule(
  moduleName: string,
  cwd = process.cwd()
): string | null {
  const srcDir = detectSrcDir(cwd);
  return findFile(join(cwd, srcDir, 'permifyjs', moduleName));
}

export function findProjectConfigModule(cwd = process.cwd()): string | null {
  return findFile(join(cwd, 'permifyjs.config'));
}

export function resolveProjectRelativeModule(
  importerPath: string,
  specifier: string
): string | null {
  if (!specifier.startsWith('.')) {
    return null;
  }

  return findFile(resolve(dirname(importerPath), specifier));
}

export function loadProjectModule<T = any>(
  modulePath: string,
  cwd = process.cwd()
): T {
  return loadCommonJsModule<T>(modulePath, cwd);
}

export function loadProjectPackage<T = any>(
  packageName: string,
  cwd = process.cwd()
): T {
  loadProjectEnv(cwd);
  const projectRequire = getProjectRequire(cwd);
  return projectRequire(packageName) as T;
}

export function loadProjectConfig<T = any>(
  cwd = process.cwd()
): T | null {
  const configPath = findProjectConfigModule(cwd);
  if (!configPath) return null;

  const configModule = loadProjectModule<Record<string, unknown>>(configPath, cwd);
  return ((configModule.default ?? configModule) as T) ?? null;
}

function loadProjectEnv(cwd: string): void {
  if (loadedEnvCwds.has(cwd)) {
    return;
  }

  for (const envFile of DEFAULT_ENV_FILES) {
    const envPath = join(cwd, envFile);
    if (!existsSync(envPath)) continue;

    applyEnvFile(readFileSync(envPath, 'utf-8'));
  }

  loadedEnvCwds.add(cwd);
}

function applyEnvFile(source: string): void {
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const exportPrefix = line.startsWith('export ') ? 'export ' : '';
    const assignment = exportPrefix ? line.slice(exportPrefix.length) : line;
    const separatorIndex = assignment.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = assignment.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = assignment.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const commentIndex = value.indexOf(' #');
      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex).trimEnd();
      }
    }

    process.env[key] = value
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
  }
}

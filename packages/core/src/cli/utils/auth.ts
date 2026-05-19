import {
  findProjectPermifyModule,
  loadProjectModule,
} from './project';

type AuthLike = {
  clearCache?: () => Promise<void>;
  isCacheEnabled?: () => boolean;
  cacheSize?: () => number;
};

export function loadProjectAuth(cwd = process.cwd()): AuthLike | null {
  const indexPath = findProjectPermifyModule('index', cwd);
  if (!indexPath) return null;

  const mod = loadProjectModule<Record<string, unknown>>(indexPath, cwd);
  const candidates = [
    mod.auth,
    (mod.default as Record<string, unknown> | undefined)?.auth,
    mod.default,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') {
      return candidate as AuthLike;
    }
  }

  return null;
}

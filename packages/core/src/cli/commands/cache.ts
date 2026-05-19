import { logger } from '../utils/logger';
import { loadProjectAuth } from '../utils/auth';

export async function runCacheCommand(action: 'clear'): Promise<void> {
  logger.blank();

  const auth = loadProjectAuth();
  if (!auth) {
    logger.warn('Could not load src/permifyjs/index auth export.');
    logger.step('Cache reset requires the generated auth module to be loadable in this project.');
    logger.blank();
    return;
  }

  if (typeof auth.clearCache !== 'function') {
    logger.warn('Loaded auth export does not expose clearCache().');
    logger.blank();
    return;
  }

  switch (action) {
    case 'clear': {
      const enabled = auth.isCacheEnabled?.() ?? false;
      const before = auth.cacheSize?.() ?? 0;

      await auth.clearCache();

      if (!enabled) {
        logger.info('Cache is not enabled for this auth instance.');
      } else {
        logger.success(`Cleared cache${before > 0 ? ` (${before} entries)` : ''}.`);
      }
      break;
    }
    default:
      logger.warn(`Unknown cache action: ${action}`);
      break;
  }

  logger.blank();
}

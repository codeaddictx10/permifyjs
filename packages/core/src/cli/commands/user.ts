import { logger } from '../utils/logger';
import { resolveCliAdapterStrategy } from '../utils/strategy';

function printFallback(action: string, opts: Record<string, string>): void {
  switch (action) {
    case 'roles':
      logger.info(`Roles for ${opts.modelType}:${opts.modelId}`);
      logger.step('Use auth.hasRole() or resolver.getRoles() in your app');
      break;
    case 'permissions':
      logger.info(`Permissions for ${opts.modelType}:${opts.modelId}`);
      logger.step('Use auth.getAllPermissions() in your app');
      break;
  }

  logger.blank();
}

export async function runUserCommand(
  action: string,
  opts: Record<string, string>
): Promise<void> {
  logger.blank();

  const strategy = await resolveCliAdapterStrategy();
  if (!strategy) {
    printFallback(action, opts);
    return;
  }

  try {
    const model = { id: opts.modelId, modelType: opts.modelType };

    switch (action) {
      case 'roles': {
        const roles = await strategy.getRoles(model);

        logger.info(`Roles for ${opts.modelType}:${opts.modelId}`);
        if (roles.length === 0) {
          logger.step('No roles found.');
          break;
        }

        for (const role of roles) {
          logger.step(role);
        }
        break;
      }
      case 'permissions': {
        const permissions = await strategy.getPermissions(model);

        logger.info(`Permissions for ${opts.modelType}:${opts.modelId}`);
        if (permissions.length === 0) {
          logger.step('No permissions found.');
          break;
        }

        for (const permission of permissions) {
          logger.step(permission);
        }
        break;
      }
      default:
        logger.warn(`Unknown user action: ${action}`);
        break;
    }
  } finally {
    await strategy.dispose();
  }

  logger.blank();
}

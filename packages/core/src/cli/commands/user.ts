import { logger } from '../utils/logger';
import { resolveCliAdapterStrategy } from '../utils/strategy';
import { formatCliScope, getCliScopeContext } from '../utils/scope';

function printFallback(action: string, opts: Record<string, string>): void {
  switch (action) {
    case 'roles':
      logger.info(`Roles for ${opts.modelType}:${opts.modelId}`);
      logger.step('Use auth.hasRole() or resolver.getRoles() in your app');
      break;
    case 'direct-permissions':
      logger.info(`Direct permissions for ${opts.modelType}:${opts.modelId}`);
      logger.step('Use auth.getDirectPermissions() in your app');
      break;
    case 'permissions-via-roles':
      logger.info(`Permissions via roles for ${opts.modelType}:${opts.modelId}`);
      logger.step('Use auth.getPermissionsThroughRoles() in your app');
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
    const context = getCliScopeContext(strategy.scopeMode, opts);
    const scopeSuffix = formatCliScope(strategy.scopeMode, context);

    switch (action) {
      case 'roles': {
        const roles = await strategy.getRoles(model, context);

        logger.info(`Roles for ${opts.modelType}:${opts.modelId}${scopeSuffix}`);
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
        const permissions = await strategy.getPermissions(model, context);

        logger.info(`Permissions for ${opts.modelType}:${opts.modelId}${scopeSuffix}`);
        if (permissions.length === 0) {
          logger.step('No permissions found.');
          break;
        }

        for (const permission of permissions) {
          logger.step(permission);
        }
        break;
      }
      case 'direct-permissions': {
        const permissions = await strategy.getDirectPermissions(model, context);

        logger.info(`Direct permissions for ${opts.modelType}:${opts.modelId}${scopeSuffix}`);
        if (permissions.length === 0) {
          logger.step('No direct permissions found.');
          break;
        }

        for (const permission of permissions) {
          logger.step(permission);
        }
        break;
      }
      case 'permissions-via-roles': {
        const permissions = await strategy.getPermissionsThroughRoles(model, context);

        logger.info(`Permissions via roles for ${opts.modelType}:${opts.modelId}${scopeSuffix}`);
        if (permissions.length === 0) {
          logger.step('No inherited permissions found.');
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

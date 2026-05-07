import { logger } from '../utils/logger';
import { resolveCliAdapterStrategy } from '../utils/strategy';
import { formatCliScope, getCliScopeContext } from '../utils/scope';

function printFallback(action: string, opts: Record<string, string>): void {
  switch (action) {
    case 'create':
      logger.info(`Creating permission: ${opts.name}`);
      break;
    case 'list':
      logger.info('Listing all permissions...');
      break;
    case 'assign':
      logger.info(`Assigning permission ${opts.permission} to role ${opts.role}`);
      break;
  }

  logger.step('Use auth.assignPermissionToRole() in your app code');
  logger.step('Or seed directly via your DB client');
  logger.blank();
}

export async function runPermissionCommand(
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
    const context = getCliScopeContext(strategy.scopeMode, opts);
    const scopeSuffix = formatCliScope(strategy.scopeMode, context);

    switch (action) {
      case 'create': {
        const result = await strategy.createPermission(opts.name);
        if (result === 'exists') {
          logger.warn(`Permission already exists: ${opts.name}`);
          break;
        }

        logger.success(`Created permission: ${opts.name}`);
        break;
      }
      case 'list': {
        const permissions = await strategy.listPermissions();
        if (permissions.length === 0) {
          logger.info('No permissions found.');
          break;
        }

        logger.info('Permissions:');
        for (const permission of permissions) {
          logger.step(permission);
        }
        break;
      }
      case 'assign':
        await strategy.assignPermissionToRole(opts.role, opts.permission, context);
        logger.success(
          `Assigned permission ${opts.permission} to role ${opts.role}${scopeSuffix}`
        );
        break;
      default:
        logger.warn(`Unknown permission action: ${action}`);
        break;
    }
  } finally {
    await strategy.dispose();
  }

  logger.blank();
}

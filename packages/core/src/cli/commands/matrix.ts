import { logger } from '../utils/logger';
import { resolveCliAdapterStrategy } from '../utils/strategy';
import { formatCliScope, getCliScopeContext } from '../utils/scope';

export async function runMatrixCommand(
  opts: Record<string, string>
): Promise<void> {
  logger.blank();

  const strategy = await resolveCliAdapterStrategy();
  if (!strategy) {
    logger.info('matrix — connect this to your resolver to execute');
    logger.step('Use auth.role(name).getPermissions() and your DB client in app code');
    logger.blank();
    return;
  }

  try {
    const context = getCliScopeContext(strategy.scopeMode, opts);
    const scopeSuffix = formatCliScope(strategy.scopeMode, context);
    const [roles, permissions] = await Promise.all([
      strategy.listRoles(context),
      strategy.listPermissions(),
    ]);

    logger.info(`Role/permission matrix${scopeSuffix}:`);

    if (roles.length === 0) {
      logger.step('No roles found.');
    }

    for (const role of roles) {
      const rolePermissions = await strategy.getRolePermissions(role, context);
      logger.step(role);

      if (rolePermissions.length === 0) {
        logger.info('  permissions: none');
        continue;
      }

      logger.info(`  permissions: ${rolePermissions.join(', ')}`);
    }

    if (permissions.length > 0) {
      logger.blank();
      logger.info('Known permissions:');
      for (const permission of permissions) {
        logger.step(permission);
      }
    }
  } finally {
    await strategy.dispose();
  }

  logger.blank();
}

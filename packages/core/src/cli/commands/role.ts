import { logger } from '../utils/logger';
import { resolveCliAdapterStrategy } from '../utils/strategy';
import { formatCliScope, getCliScopeContext } from '../utils/scope';

function printFallback(action: string, opts: Record<string, string>): void {
  logger.info(`role:${action} — connect this to your resolver to execute`);
  logger.step('Use auth.assignRole(), auth.removeRole() in your app code');
  logger.step('Or seed directly via your DB client');
  logger.blank();

  switch (action) {
    case 'create':
      logger.info(`Creating role: ${opts.name}`);
      break;
    case 'list':
      logger.info('Listing all roles...');
      break;
    case 'assign':
      logger.info(`Assigning role ${opts.role} to ${opts.modelType}:${opts.modelId}`);
      break;
    case 'remove':
      logger.info(`Removing role ${opts.role} from ${opts.modelType}:${opts.modelId}`);
      break;
  }
}

export async function runRoleCommand(
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
        const result = await strategy.createRole(opts.name);
        if (result === 'exists') {
          logger.warn(`Role already exists: ${opts.name}`);
          break;
        }

        logger.success(`Created role: ${opts.name}`);
        break;
      }
      case 'list': {
        const roles = await strategy.listRoles();
        if (roles.length === 0) {
          logger.info('No roles found.');
          break;
        }

        logger.info('Roles:');
        for (const role of roles) {
          logger.step(role);
        }
        break;
      }
      case 'assign':
        await strategy.assignRole(
          { id: opts.modelId, modelType: opts.modelType },
          opts.role,
          context
        );
        logger.success(
          `Assigned role ${opts.role} to ${opts.modelType}:${opts.modelId}${scopeSuffix}`
        );
        break;
      case 'remove':
        await strategy.removeRole(
          { id: opts.modelId, modelType: opts.modelType },
          opts.role,
          context
        );
        logger.success(
          `Removed role ${opts.role} from ${opts.modelType}:${opts.modelId}${scopeSuffix}`
        );
        break;
      default:
        logger.warn(`Unknown role action: ${action}`);
        break;
    }
  } finally {
    await strategy.dispose();
  }

  logger.blank();
}

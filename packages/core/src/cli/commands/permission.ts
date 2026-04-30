import { logger } from '../utils/logger';

export async function runPermissionCommand(
  action: string,
  opts: Record<string, string>
): Promise<void> {
  logger.blank();

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

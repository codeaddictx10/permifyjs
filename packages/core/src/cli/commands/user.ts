import { logger } from '../utils/logger';

export async function runUserCommand(
  action: string,
  opts: Record<string, string>
): Promise<void> {
  logger.blank();

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

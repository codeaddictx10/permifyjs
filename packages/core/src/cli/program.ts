import { Command } from 'commander';
import { runInit } from './commands/init';
import { runMigrate } from './commands/migrate';
import { runRoleCommand } from './commands/role';
import { runPermissionCommand } from './commands/permission';
import { runUserCommand } from './commands/user';
import { runMatrixCommand } from './commands/matrix';
import { runCacheCommand } from './commands/cache';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('permifyjs')
    .description('permifyjs — framework agnostic RBAC for Node.js')
    .version('0.1.0');

  program
    .command('init')
    .description('Set up permifyjs in your project')
    .action(runInit);

  program
    .command('migrate')
    .description('Run permifyjs migrations')
    .action(() => runMigrate('migrate'));

  program
    .command('migrate:rollback')
    .description('Rollback last migration')
    .action(() => runMigrate('rollback'));

  program
    .command('migrate:fresh')
    .description('Drop all tables and re-run migrations')
    .action(() => runMigrate('fresh'));

  program
    .command('migrate:status')
    .description('Show migration status')
    .action(() => runMigrate('status'));

  program
    .command('role:create <name>')
    .description('Create a new role')
    .option('--tenant-id <tenantId>', 'Tenant ID for scoped role creation')
    .option('--team-id <teamId>', 'Team ID for scoped role creation')
    .action((name, opts) => runRoleCommand('create', { name, ...opts }));

  program
    .command('role:list')
    .description('List all roles')
    .option('--tenant-id <tenantId>', 'Tenant ID for scoped role listing')
    .option('--team-id <teamId>', 'Team ID for scoped role listing')
    .action((opts) => runRoleCommand('list', opts));

  program
    .command('role:assign')
    .description('Assign a role to a model')
    .requiredOption('--model-id <id>', 'Model ID')
    .option('--model-type <type>', 'Model type', 'User')
    .requiredOption('--role <role>', 'Role name')
    .option('--tenant-id <tenantId>', 'Tenant ID for scoped assignments')
    .option('--team-id <teamId>', 'Team ID for scoped assignments')
    .action((opts) => runRoleCommand('assign', opts));

  program
    .command('role:remove')
    .description('Remove a role from a model')
    .requiredOption('--model-id <id>', 'Model ID')
    .option('--model-type <type>', 'Model type', 'User')
    .requiredOption('--role <role>', 'Role name')
    .option('--tenant-id <tenantId>', 'Tenant ID for scoped assignments')
    .option('--team-id <teamId>', 'Team ID for scoped assignments')
    .action((opts) => runRoleCommand('remove', opts));

  program
    .command('permission:create <name>')
    .description('Create a new permission')
    .action((name) => runPermissionCommand('create', { name }));

  program
    .command('permission:list')
    .description('List all permissions')
    .action(() => runPermissionCommand('list', {}));

  program
    .command('permission:assign')
    .description('Assign a permission to a role')
    .requiredOption('--role <role>', 'Role name')
    .requiredOption('--permission <permission>', 'Permission name')
    .option('--tenant-id <tenantId>', 'Tenant ID for scoped assignments')
    .option('--team-id <teamId>', 'Team ID for scoped assignments')
    .action((opts) => runPermissionCommand('assign', opts));

  program
    .command('matrix')
    .description('Show the current role/permission matrix')
    .option('--tenant-id <tenantId>', 'Tenant ID for scoped role matrices')
    .option('--team-id <teamId>', 'Team ID for scoped role matrices')
    .action((opts) => runMatrixCommand(opts));

  program
    .command('cache:clear')
    .description('Clear the auth cache for the current project auth module')
    .action(() => runCacheCommand('clear'));

  program
    .command('user:roles')
    .description('List roles for a model')
    .requiredOption('--model-id <id>', 'Model ID')
    .option('--model-type <type>', 'Model type', 'User')
    .option('--tenant-id <tenantId>', 'Tenant ID for scoped lookups')
    .option('--team-id <teamId>', 'Team ID for scoped lookups')
    .action((opts) => runUserCommand('roles', opts));

  program
    .command('user:direct-permissions')
    .description('List direct permissions for a model')
    .requiredOption('--model-id <id>', 'Model ID')
    .option('--model-type <type>', 'Model type', 'User')
    .option('--tenant-id <tenantId>', 'Tenant ID for scoped lookups')
    .option('--team-id <teamId>', 'Team ID for scoped lookups')
    .action((opts) => runUserCommand('direct-permissions', opts));

  program
    .command('user:permissions-via-roles')
    .description('List inherited permissions for a model')
    .requiredOption('--model-id <id>', 'Model ID')
    .option('--model-type <type>', 'Model type', 'User')
    .option('--tenant-id <tenantId>', 'Tenant ID for scoped lookups')
    .option('--team-id <teamId>', 'Team ID for scoped lookups')
    .action((opts) => runUserCommand('permissions-via-roles', opts));

  program
    .command('user:permissions')
    .description('List permissions for a model')
    .requiredOption('--model-id <id>', 'Model ID')
    .option('--model-type <type>', 'Model type', 'User')
    .option('--tenant-id <tenantId>', 'Tenant ID for scoped lookups')
    .option('--team-id <teamId>', 'Team ID for scoped lookups')
    .action((opts) => runUserCommand('permissions', opts));

  return program;
}

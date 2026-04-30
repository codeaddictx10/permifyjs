import { Command } from 'commander';
import { runInit } from './commands/init';
import { runMigrate } from './commands/migrate';
import { runRoleCommand } from './commands/role';
import { runPermissionCommand } from './commands/permission';
import { runUserCommand } from './commands/user';

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
    .action((name) => runRoleCommand('create', { name }));

  program
    .command('role:list')
    .description('List all roles')
    .action(() => runRoleCommand('list', {}));

  program
    .command('role:assign')
    .description('Assign a role to a model')
    .requiredOption('--model-id <id>', 'Model ID')
    .option('--model-type <type>', 'Model type', 'User')
    .requiredOption('--role <role>', 'Role name')
    .action((opts) => runRoleCommand('assign', opts));

  program
    .command('role:remove')
    .description('Remove a role from a model')
    .requiredOption('--model-id <id>', 'Model ID')
    .option('--model-type <type>', 'Model type', 'User')
    .requiredOption('--role <role>', 'Role name')
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
    .action((opts) => runPermissionCommand('assign', opts));

  program
    .command('user:roles')
    .description('List roles for a model')
    .requiredOption('--model-id <id>', 'Model ID')
    .option('--model-type <type>', 'Model type', 'User')
    .action((opts) => runUserCommand('roles', opts));

  program
    .command('user:permissions')
    .description('List permissions for a model')
    .requiredOption('--model-id <id>', 'Model ID')
    .option('--model-type <type>', 'Model type', 'User')
    .action((opts) => runUserCommand('permissions', opts));

  return program;
}

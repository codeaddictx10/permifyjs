import ora from 'ora';
import { execa } from 'execa';
import { logger } from '../utils/logger';
import { detectPrisma, detectMongoose, detectTypeORM } from '../utils/detect';
import { loadTypeOrmRuntime } from '../utils/typeorm';

export async function runMigrate(
  action: 'migrate' | 'rollback' | 'fresh' | 'status'
): Promise<void> {
  logger.blank();

  if (detectPrisma()) {
    await migratePrisma(action);
    return;
  }

  if (detectMongoose()) {
    await migrateMongoose(action);
    return;
  }

  if (detectTypeORM()) {
    await migrateTypeOrm(action);
    return;
  }

  logger.error('No adapter detected. Run npx permifyjs init first.');
  process.exit(1);
}

async function migratePrisma(action: string): Promise<void> {
  const spinner = ora('Running Prisma migration...').start();

  try {
    const commands: Record<string, string[]> = {
      migrate: ['prisma', 'migrate', 'dev', '--name', 'add_permifyjs'],
      rollback: ['prisma', 'migrate', 'reset', '--force'],
      fresh: ['prisma', 'migrate', 'reset', '--force'],
      status: ['prisma', 'migrate', 'status'],
    };

    const [cmd, ...args] = commands[action];
    await execa(cmd, args, { stdio: 'inherit', cwd: process.cwd() });
    spinner.succeed('Prisma migration complete');
  } catch (err) {
    spinner.fail('Prisma migration failed');
    logger.error(String(err));
    process.exit(1);
  }
}

async function migrateMongoose(action: string): Promise<void> {
  const spinner = ora('Setting up MongoDB collections...').start();

  try {
    if (action === 'status') {
      spinner.info('Mongoose creates collections automatically on first write');
      return;
    }
    spinner.succeed('MongoDB collections will be created on first write');
    logger.info('Make sure registerPermifyModels() is called in your app');
  } catch (err) {
    spinner.fail('MongoDB setup failed');
    logger.error(String(err));
  }
}

async function migrateTypeOrm(action: string): Promise<void> {
  const spinner = ora('Running TypeORM permifyjs migration...').start();
  const runtime = await loadTypeOrmRuntime();

  if (!runtime) {
    spinner.fail('TypeORM runtime could not be loaded');
    process.exit(1);
  }

  try {
    switch (action) {
      case 'migrate':
        await runtime.syncPermifySchema(runtime.dataSource, {
          tableNames: runtime.tableNames,
          scopeMode: runtime.scopeMode,
        });
        spinner.succeed('TypeORM permifyjs tables are ready');
        break;
      case 'rollback':
        await runtime.dropPermifySchema(runtime.dataSource, {
          tableNames: runtime.tableNames,
          scopeMode: runtime.scopeMode,
        });
        spinner.succeed('Dropped TypeORM permifyjs tables');
        break;
      case 'fresh':
        await runtime.dropPermifySchema(runtime.dataSource, {
          tableNames: runtime.tableNames,
          scopeMode: runtime.scopeMode,
        });
        await runtime.syncPermifySchema(runtime.dataSource, {
          tableNames: runtime.tableNames,
          scopeMode: runtime.scopeMode,
        });
        spinner.succeed('Recreated TypeORM permifyjs tables');
        break;
      case 'status': {
        const status = await runtime.getPermifySchemaStatus(runtime.dataSource, {
          tableNames: runtime.tableNames,
          scopeMode: runtime.scopeMode,
        }) as {
          allPresent: boolean;
          tables: Record<string, boolean>;
        };

        if (status.allPresent) {
          spinner.succeed('All permifyjs TypeORM tables are present');
        } else {
          spinner.warn('Some permifyjs TypeORM tables are missing');
          for (const [table, present] of Object.entries(status.tables)) {
            logger.step(`${table}: ${present ? 'present' : 'missing'}`);
          }
        }
        break;
      }
      default:
        spinner.warn(`Unknown TypeORM migration action: ${action}`);
        break;
    }
  } catch (err) {
    spinner.fail('TypeORM migration failed');
    logger.error(String(err));
    process.exit(1);
  } finally {
    if (runtime.initializedHere) {
      await runtime.dataSource.destroy?.();
    }
  }
}

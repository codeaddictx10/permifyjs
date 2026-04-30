import ora from 'ora';
import { execa } from 'execa';
import { logger } from '../utils/logger';
import { detectPrisma, detectMongoose } from '../utils/detect';

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

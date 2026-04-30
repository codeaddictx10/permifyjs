import prompts from 'prompts';
import ora from 'ora';
import { join } from 'path';
import { logger } from '../utils/logger';
import { generateFile, writeFile, fileExists, readFile, appendToFile } from '../utils/generator';
import { detectPackageManager, detectInstalledAdapter, detectInstalledFramework, detectPrismaClientImportPath, detectPrismaSchemaPath, detectSrcDir } from '../utils/detect';
import { installPackages } from '../utils/installer';
import type { AdapterType, FrameworkType } from '../../types';

function getTemplatesDir(): string {
  const candidates = [
    join(__dirname, '../templates'),
    join(__dirname, 'templates'),
  ];

  for (const candidate of candidates) {
    try {
      if (require('fs').existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // ignore and try the next candidate
    }
  }

  return candidates[0];
}

const TEMPLATES_DIR = getTemplatesDir();

export async function runInit(): Promise<void> {
  logger.blank();
  logger.title('Welcome to permifyjs 🔐');
  logger.blank();

  // ─── Detect existing setup ──────────────────────────────────────

  const detectedAdapter = detectInstalledAdapter();
  const detectedFramework = detectInstalledFramework();
  const packageManager = detectPackageManager();
  const srcDir = detectSrcDir();
  const detectedPrismaClientImportPath = detectPrismaClientImportPath(srcDir);

  // ─── Prompts ────────────────────────────────────────────────────

  const answers = await prompts(
    [
      {
        type: 'select',
        name: 'adapter',
        message: 'Which database adapter are you using?',
        choices: [
          { title: 'Prisma (SQL)', value: 'prisma' },
          { title: 'Mongoose (MongoDB)', value: 'mongoose' },
          { title: 'TypeORM (SQL)', value: 'typeorm' },
        ],
        initial: detectedAdapter
          ? ['prisma', 'mongoose', 'typeorm'].indexOf(detectedAdapter)
          : 0,
      },
      {
        type: 'select',
        name: 'framework',
        message: 'Which framework are you using?',
        choices: [
          { title: 'Express', value: 'express' },
          { title: 'NestJS', value: 'nestjs' },
          { title: 'Fastify', value: 'fastify' },
        ],
        initial: detectedFramework
          ? ['express', 'nestjs', 'fastify'].indexOf(detectedFramework)
          : 0,
      },
      {
        type: 'list',
        name: 'models',
        message: 'Which models can have roles/permissions? (comma separated)',
        initial: 'User',
        separator: ',',
      },
      {
        type: 'confirm',
        name: 'enableCache',
        message: 'Enable permission caching?',
        initial: true,
      },
      {
        type: (_, values) => (values.adapter === 'prisma' ? 'text' : null),
        name: 'prismaClientImportPath',
        message: 'Import path to your Prisma client instance (relative to generated permify files)',
        initial: detectedPrismaClientImportPath ?? '../lib/prisma',
        validate: (value: string) => {
          if (!value || !value.trim()) {
            return 'Prisma client import path is required';
          }
          return true;
        },
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: (prev: boolean, values: any) =>
          `Ready to set up permifyjs with ${values.adapter} + ${values.framework}. Continue?`,
        initial: true,
      },
    ],
    {
      onCancel: () => {
        logger.error('Setup cancelled.');
        process.exit(1);
      },
    }
  );

  if (!answers.confirm) {
    logger.error('Setup cancelled.');
    process.exit(1);
  }

  const adapter = answers.adapter as AdapterType;
  const framework = answers.framework as FrameworkType;
  const models = (answers.models as string[]).map((m: string) => m.trim()).filter(Boolean);
  const enableCache = answers.enableCache as boolean;
  const prismaClientImportPath = (answers.prismaClientImportPath as string | undefined)?.trim();

  logger.blank();

  // ─── Install packages ───────────────────────────────────────────

  const spinner = ora('Installing packages...').start();

  const packagesToInstall = [
    '@permifyjs/core',
    `@permifyjs/${framework}`,
    `@permifyjs/${adapter}`,
  ];

  try {
    await installPackages(packagesToInstall, packageManager);
    spinner.succeed(`Installed ${packagesToInstall.join(', ')}`);
  } catch (err) {
    spinner.fail('Failed to install packages');
    logger.error(String(err));
    process.exit(1);
  }

  // ─── Generate permifyjs.config.ts ──────────────────────────────

  const configPath = join(process.cwd(), 'permifyjs.config.ts');
  const configExists = await fileExists(configPath);

  if (configExists) {
    logger.warn('permifyjs.config.ts already exists — skipping');
  } else {
    await generateFile(
      join(TEMPLATES_DIR, 'config.hbs'),
      configPath,
      { adapter, framework, models, enableCache }
    );
    logger.success('Generated permifyjs.config.ts');
  }

  // ─── Generate src/permifyjs/ files ─────────────────────────────

  const permifyDir = join(process.cwd(), srcDir, 'permifyjs');

  // resolver.ts
  const resolverPath = join(permifyDir, 'resolver.ts');
  if (await fileExists(resolverPath)) {
    logger.warn('src/permifyjs/resolver.ts already exists — skipping');
  } else {
    await generateFile(
      join(TEMPLATES_DIR, adapter, 'resolver.hbs'),
      resolverPath,
      { adapter, framework, models, prismaClientImportPath }
    );
    logger.success(`Generated ${srcDir}/permifyjs/resolver.ts`);
  }

  // writeResolver.ts
  const writeResolverPath = join(permifyDir, 'writeResolver.ts');
  if (await fileExists(writeResolverPath)) {
    logger.warn('src/permifyjs/writeResolver.ts already exists — skipping');
  } else {
    await generateFile(
      join(TEMPLATES_DIR, adapter, 'writeResolver.hbs'),
      writeResolverPath,
      { adapter, framework, models, prismaClientImportPath }
    );
    logger.success(`Generated ${srcDir}/permifyjs/writeResolver.ts`);
  }

  // index.ts
  const indexPath = join(permifyDir, 'index.ts');
  if (await fileExists(indexPath)) {
    logger.warn('src/permifyjs/index.ts already exists — skipping');
  } else {
    await generateFile(
      join(TEMPLATES_DIR, 'index.hbs'),
      indexPath,
      { adapter, framework, models, enableCache }
    );
    logger.success(`Generated ${srcDir}/permifyjs/index.ts`);
  }

  // ─── Adapter specific setup ─────────────────────────────────────

  if (adapter === 'prisma') {
    await setupPrisma();
  }

  if (adapter === 'mongoose') {
    await setupMongoose(srcDir);
  }

  // ─── Done ───────────────────────────────────────────────────────

  logger.blank();
  logger.title('✔ permifyjs is ready! 🎉');
  logger.blank();
  logger.info('Next steps:');
  logger.step(`1. Import auth from './${srcDir}/permifyjs'`);
  logger.step(`2. Use authorize() middleware in your routes`);

  if (adapter === 'prisma') {
    logger.step('3. Run: npx prisma migrate dev --name add_permifyjs');
  }

  if (adapter === 'mongoose') {
    logger.step('3. Call registerPermifyModels() before connecting to MongoDB');
  }

  logger.blank();
  logger.info('Create roles and permissions:');
  logger.step('npx permifyjs role:create admin');
  logger.step('npx permifyjs permission:create post.create');
  logger.blank();
}

// ─── Adapter setup helpers ──────────────────────────────────────

async function setupPrisma(): Promise<void> {
  const spinner = ora('Looking for schema.prisma...').start();
  spinner.stop();

  let schemaPath = detectPrismaSchemaPath();

  // ─── Can't detect — ask the user ─────────────────────────────
  if (!schemaPath) {
    logger.warn('Could not detect schema.prisma location.');

    const answer = await prompts([
      {
        type: 'confirm',
        name: 'locate',
        message: 'Would you like to specify the path manually?',
        initial: true,
      },
      {
        type: (prev) => (prev ? 'text' : null),
        name: 'customPath',
        message: 'Enter path to schema.prisma',
        initial: 'prisma/schema.prisma',
        validate: async (value) => {
          const exists = await fileExists(join(process.cwd(), value));
          if (!exists) return `File not found: ${value}`;
          return true;
        },
      },
    ]);

    if (!answer.locate || !answer.customPath) {
      // ─── User declined — create a new schema.prisma ───────────
      const createAnswer = await prompts({
        type: 'confirm',
        name: 'create',
        message: 'Would you like permifyjs to create a schema.prisma for you?',
        initial: true,
      });

      if (createAnswer.create) {
        schemaPath = await createPrismaSchema();
      } else {
        // ─── Last resort — copy schema fragment to a file ─────────
        await copySchemaFragment();
        return;
      }
    } else {
      schemaPath = join(process.cwd(), answer.customPath);
    }
  }

  // ─── Append permifyjs models to schema ───────────────────────

  const appendSpinner = ora('Adding permifyjs models to schema.prisma...').start();

  try {
    const existingSchema = await readFile(schemaPath);

    if (existingSchema.includes('PermifyRole')) {
      appendSpinner.warn('permifyjs models already in schema.prisma — skipping');
      return;
    }

    const schemaFragment = await readFile(
      join(TEMPLATES_DIR, 'prisma/schema.hbs')
    );

    await appendToFile(schemaPath, `\n\n${schemaFragment}`);
    appendSpinner.succeed(`Added permifyjs models to ${schemaPath}`);
    logger.info('Run: npx prisma migrate dev --name add_permifyjs');
  } catch (err) {
    appendSpinner.fail('Failed to update schema.prisma');
    logger.error(String(err));
  }
}

// ─── Creates a minimal schema.prisma if none exists ──────────────

async function createPrismaSchema(): Promise<string> {
  const spinner = ora('Creating schema.prisma...').start();

  const schemaPath = join(process.cwd(), 'prisma/schema.prisma');

  const baseSchema = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
`;

  const schemaFragment = await readFile(
    join(TEMPLATES_DIR, 'prisma/schema.hbs')
  );

  await writeFile(schemaPath, `${baseSchema}\n${schemaFragment}`);
  spinner.succeed('Created prisma/schema.prisma');
  logger.info('Update the datasource provider if you are not using PostgreSQL');
  logger.info('Run: npx prisma migrate dev --name add_permifyjs');

  return schemaPath;
}

// ─── Copies schema fragment as a standalone file ──────────────────
// Last resort — user handles merging themselves

async function copySchemaFragment(): Promise<void> {
  const spinner = ora('Copying schema fragment...').start();

  try {
    const schemaFragment = await readFile(
      join(TEMPLATES_DIR, 'prisma/schema.hbs')
    );

    const outputPath = join(process.cwd(), 'permifyjs.schema.prisma');
    await writeFile(outputPath, schemaFragment);

    spinner.succeed('Created permifyjs.schema.prisma');
    logger.blank();
    logger.warn('Action required:');
    logger.step('1. Open permifyjs.schema.prisma');
    logger.step('2. Copy the models into your schema.prisma');
    logger.step('3. Run: npx prisma migrate dev --name add_permifyjs');
    logger.step('4. Delete permifyjs.schema.prisma');
  } catch (err) {
    spinner.fail('Failed to copy schema fragment');
    logger.error(String(err));
  }
}

async function setupMongoose(srcDir: string): Promise<void> {
  const spinner = ora('Setting up Mongoose models...').start();

  try {
    const registerPath = join(
      process.cwd(),
      srcDir,
      'permifyjs/registerModels.ts'
    );

    await writeFile(
      registerPath,
      `import { registerPermifyModels } from '@permifyjs/mongoose';

// Call this before connecting to MongoDB
registerPermifyModels();
`
    );

    spinner.succeed('Generated src/permifyjs/registerModels.ts');
    logger.info('Call registerPermifyModels() in your app entry before mongoose.connect()');
  } catch (err) {
    spinner.fail('Failed to set up Mongoose models');
    logger.error(String(err));
  }
}

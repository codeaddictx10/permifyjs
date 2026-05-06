import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join, resolve } from 'path';
import { tmpdir } from 'os';
import { registerPermifyModels } from '../../../mongoose/src';

let DatabaseSync:
  | (new (path: string) => {
      prepare(sql: string): { get(): Record<string, unknown> | undefined };
      close(): void;
    })
  | null = null;

try {
  ({ DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite'));
} catch {
  DatabaseSync = null;
}

const tempDirs: string[] = [];
const originalCwd = process.cwd();
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalMongoUri = process.env.MONGODB_URI;
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const repoRoot = resolve(dirname(__filename), '../../../..');
const exampleAppDir = join(repoRoot, 'examples', 'express-app');
const mongooseWorkspaceDir = join(repoRoot, 'packages', 'mongoose');
const runMongoCliIntegration = process.env.PERMIFYJS_RUN_MONGOOSE_INTEGRATION === '1';
const mongooseWorkspaceRequire = createRequire(
  join(mongooseWorkspaceDir, 'package.json')
);
const mongoose = mongooseWorkspaceRequire('mongoose') as typeof import('mongoose');
const { MongoMemoryServer } = mongooseWorkspaceRequire('mongodb-memory-server') as typeof import('mongodb-memory-server');

function createPrismaProject(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'permifyjs-role-cli-'));
  tempDirs.push(cwd);

  mkdirSync(join(cwd, 'src', 'permifyjs'), { recursive: true });
  mkdirSync(join(cwd, 'prisma'), { recursive: true });

  writeFileSync(
    join(cwd, 'package.json'),
    JSON.stringify({
      name: 'test-app',
      dependencies: {
        '@permifyjs/prisma': 'workspace:*',
        '@prisma/client': '^7.8.0',
        prisma: '^7.8.0',
      },
    })
  );
  writeFileSync(join(cwd, '.env'), 'DATABASE_URL="file:./prisma/dev.db"\n');

  cpSync(join(exampleAppDir, 'src', 'db.ts'), join(cwd, 'src', 'db.ts'));
  cpSync(
    join(exampleAppDir, 'src', 'permifyjs', 'writeResolver.ts'),
    join(cwd, 'src', 'permifyjs', 'writeResolver.ts')
  );
  cpSync(join(exampleAppDir, 'prisma', 'dev.db'), join(cwd, 'prisma', 'dev.db'));
  symlinkSync(join(exampleAppDir, 'node_modules'), join(cwd, 'node_modules'), 'dir');

  return cwd;
}

function createMongooseProject(mongoUri: string): string {
  const cwd = mkdtempSync(join(tmpdir(), 'permifyjs-mongoose-cli-'));
  tempDirs.push(cwd);

  mkdirSync(join(cwd, 'src', 'permifyjs'), { recursive: true });
  mkdirSync(join(cwd, 'node_modules', '@permifyjs'), { recursive: true });

  writeFileSync(
    join(cwd, 'package.json'),
    JSON.stringify({
      name: 'test-mongoose-app',
      dependencies: {
        '@permifyjs/mongoose': 'workspace:*',
        mongoose: '^8.19.2',
      },
    })
  );
  writeFileSync(join(cwd, '.env'), `MONGODB_URI="${mongoUri}"\n`);
  writeFileSync(
    join(cwd, 'src', 'permifyjs', 'writeResolver.ts'),
    `import type { PermissionWriteResolver } from '@permifyjs/core';
import { createMongooseWriteResolver } from '@permifyjs/mongoose';

export const writeResolver: PermissionWriteResolver = createMongooseWriteResolver();
`
  );

  symlinkSync(
    join(mongooseWorkspaceDir, 'node_modules', 'mongoose'),
    join(cwd, 'node_modules', 'mongoose'),
    'dir'
  );
  symlinkSync(
    mongooseWorkspaceDir,
    join(cwd, 'node_modules', '@permifyjs', 'mongoose'),
    'dir'
  );

  return cwd;
}

function queryScalar(databasePath: string, sql: string): unknown {
  if (!DatabaseSync) {
    throw new Error('node:sqlite is unavailable in this Node.js runtime');
  }

  const db = new DatabaseSync(databasePath);

  try {
    const row = db.prepare(sql).get() as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return Object.values(row)[0];
  } finally {
    db.close();
  }
}

function getOutput(): string {
  return consoleLogSpy.mock.calls
    .flatMap((call) => call.map((value) => String(value)))
    .join('\n')
    .replace(/\u001B\[[0-9;]*m/g, '');
}

describe('runRoleCommand() with a real Prisma DB', () => {
  beforeEach(() => {
    consoleLogSpy.mockClear();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.env.DATABASE_URL = originalDatabaseUrl;
    process.env.MONGODB_URI = originalMongoUri;

    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(!DatabaseSync)(
    'creates, lists, assigns, and removes roles against the project database',
    async () => {
    const cwd = createPrismaProject();
    const dbPath = join(cwd, 'prisma', 'dev.db');

    process.chdir(cwd);
    process.env.DATABASE_URL = `file:${dbPath}`;

    const { runRoleCommand } = await import('../cli/commands/role');

    await runRoleCommand('create', { name: 'editor-cli' });
    expect(
      queryScalar(dbPath, "select count(*) from roles where name = 'editor-cli'")
    ).toBe(1);

    await runRoleCommand('list', {});
    const output = getOutput();
    expect(output).toContain('Roles:');
    expect(output).toContain('admin');
    expect(output).toContain('editor-cli');

    await runRoleCommand('assign', {
      modelId: 'cli-user',
      modelType: 'User',
      role: 'editor-cli',
    });
    expect(
      queryScalar(
        dbPath,
        `select count(*)
         from model_has_roles mhr
         join roles r on r.id = mhr.roleId
         where mhr.modelId = 'cli-user'
           and mhr.modelType = 'User'
           and r.name = 'editor-cli'`
      )
    ).toBe(1);

    await runRoleCommand('remove', {
      modelId: 'cli-user',
      modelType: 'User',
      role: 'editor-cli',
    });
    expect(
      queryScalar(
        dbPath,
        `select count(*)
         from model_has_roles mhr
         join roles r on r.id = mhr.roleId
         where mhr.modelId = 'cli-user'
           and mhr.modelType = 'User'
           and r.name = 'editor-cli'`
      )
    ).toBe(0);
    }
  );

  it.skipIf(!DatabaseSync)(
    'loads DATABASE_URL from the project .env when the shell env is unset',
    async () => {
    const cwd = createPrismaProject();
    const dbPath = join(cwd, 'prisma', 'dev.db');

    process.chdir(cwd);
    delete process.env.DATABASE_URL;

    const { runRoleCommand } = await import('../cli/commands/role');

    await runRoleCommand('create', { name: 'env-loaded-role' });
    expect(
      queryScalar(dbPath, "select count(*) from roles where name = 'env-loaded-role'")
    ).toBe(1);
    }
  );

  it.skipIf(!DatabaseSync)(
    'creates, lists, and assigns permissions against the project database',
    async () => {
    const cwd = createPrismaProject();
    const dbPath = join(cwd, 'prisma', 'dev.db');

    process.chdir(cwd);
    process.env.DATABASE_URL = `file:${dbPath}`;

    const { runPermissionCommand } = await import('../cli/commands/permission');

    await runPermissionCommand('create', { name: 'post.publish' });
    expect(
      queryScalar(dbPath, "select count(*) from permissions where name = 'post.publish'")
    ).toBe(1);

    await runPermissionCommand('list', {});
    const output = getOutput();
    expect(output).toContain('Permissions:');
    expect(output).toContain('can create users');
    expect(output).toContain('post.publish');

    await runPermissionCommand('assign', {
      role: 'admin',
      permission: 'post.publish',
    });
    expect(
      queryScalar(
        dbPath,
        `select count(*)
         from role_has_permissions rhp
         join roles r on r.id = rhp.roleId
         join permissions p on p.id = rhp.permissionId
         where r.name = 'admin'
           and p.name = 'post.publish'`
      )
    ).toBe(1);
    }
  );

  it.skipIf(!DatabaseSync)(
    'reads user roles and permissions from the project database',
    async () => {
    const cwd = createPrismaProject();
    const dbPath = join(cwd, 'prisma', 'dev.db');

    process.chdir(cwd);
    process.env.DATABASE_URL = `file:${dbPath}`;

    const { runUserCommand } = await import('../cli/commands/user');

    await runUserCommand('roles', {
      modelId: '1',
      modelType: 'User',
    });
    let output = getOutput();
    expect(output).toContain('Roles for User:1');
    expect(output).toContain('admin');

    consoleLogSpy.mockClear();

    await runUserCommand('permissions', {
      modelId: '1',
      modelType: 'User',
    });
    output = getOutput();
    expect(output).toContain('Permissions for User:1');
    expect(output).toContain('can create users');
    expect(output).toContain('can view all');
    expect(output).toContain('can view users');
    }
  );

  it.skipIf(!runMongoCliIntegration)(
    'runs role, permission, and user commands against a real mongoose database',
    async () => {
    const mongoServer = await MongoMemoryServer.create({
      instance: { ip: '127.0.0.1' },
    });

    try {
      const mongoUri = mongoServer.getUri();
      const cwd = createMongooseProject(mongoUri);

      const connection = await mongoose.createConnection(mongoUri).asPromise();
      const models = registerPermifyModels({ connection });

      const [adminRole, viewUsersPermission, viewAllPermission] = await Promise.all([
        models.Role.create({ name: 'admin' }),
        models.Permission.create({ name: 'can view users' }),
        models.Permission.create({ name: 'can view all' }),
      ]);

      await models.RoleHasPermission.create({
        roleId: adminRole._id,
        permissionId: viewUsersPermission._id,
      });
      await models.ModelHasRole.create({
        modelId: 'user-1',
        modelType: 'User',
        roleId: adminRole._id,
      });
      await models.ModelHasPermission.create({
        modelId: 'user-1',
        modelType: 'User',
        permissionId: viewAllPermission._id,
      });

      await connection.close();

      process.chdir(cwd);
      delete process.env.MONGODB_URI;

      const { runRoleCommand } = await import('../cli/commands/role');
      const { runPermissionCommand } = await import('../cli/commands/permission');
      const { runUserCommand } = await import('../cli/commands/user');

      await runRoleCommand('create', { name: 'editor' });
      let verifyConnection = await mongoose.createConnection(mongoUri).asPromise();
      let verifyModels = registerPermifyModels({ connection: verifyConnection });
      expect(await verifyModels.Role.countDocuments({ name: 'editor' })).toBe(1);
      await verifyConnection.close();

      consoleLogSpy.mockClear();
      await runRoleCommand('assign', {
        modelId: 'user-2',
        modelType: 'User',
        role: 'editor',
      });
      verifyConnection = await mongoose.createConnection(mongoUri).asPromise();
      verifyModels = registerPermifyModels({ connection: verifyConnection });
      const editorRole = await verifyModels.Role.findOne({ name: 'editor' }).lean();
      expect(editorRole?._id).toBeTruthy();
      expect(
        await verifyModels.ModelHasRole.countDocuments({
          modelId: 'user-2',
          modelType: 'User',
          roleId: editorRole?._id,
        })
      ).toBe(1);
      await verifyConnection.close();

      consoleLogSpy.mockClear();
      await runPermissionCommand('create', { name: 'post.publish' });
      verifyConnection = await mongoose.createConnection(mongoUri).asPromise();
      verifyModels = registerPermifyModels({ connection: verifyConnection });
      expect(
        await verifyModels.Permission.countDocuments({ name: 'post.publish' })
      ).toBe(1);

      await runPermissionCommand('assign', {
        role: 'editor',
        permission: 'post.publish',
      });
      const publishPermission = await verifyModels.Permission.findOne({
        name: 'post.publish',
      }).lean();
      expect(
        await verifyModels.RoleHasPermission.countDocuments({
          roleId: editorRole?._id,
          permissionId: publishPermission?._id,
        })
      ).toBe(1);
      await verifyConnection.close();

      consoleLogSpy.mockClear();
      await runUserCommand('roles', {
        modelId: 'user-1',
        modelType: 'User',
      });
      let output = getOutput();
      expect(output).toContain('Roles for User:user-1');
      expect(output).toContain('admin');

      consoleLogSpy.mockClear();
      await runUserCommand('permissions', {
        modelId: 'user-1',
        modelType: 'User',
      });
      output = getOutput();
      expect(output).toContain('Permissions for User:user-1');
      expect(output).toContain('can view all');
      expect(output).toContain('can view users');
    } finally {
      await mongoServer.stop();
    }
    },
    60000
  );
});

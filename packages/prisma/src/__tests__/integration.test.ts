import { afterAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { createRequire } from 'module';
import { tmpdir } from 'os';
import { pathToFileURL } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { createPrismaResolver } from '../resolver';
import { createPrismaWriteResolver } from '../writeResolver';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const tempDirs: string[] = [];
const packageDir = dirname(dirname(import.meta.filename));
const require = createRequire(import.meta.url);
// Opt-in because Prisma's native SQLite adapter is environment-sensitive in CI/sandboxed runs.
const runPrismaIntegration = process.env.PERMIFYJS_RUN_PRISMA_INTEGRATION === '1';

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'permifyjs-prisma-'));
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('@permifyjs/prisma integration', () => {
  it.skipIf(!runPrismaIntegration)(
    'reads and writes roles and permissions against a real sqlite-backed prisma client',
    async () => {
      const tempDir = createTempDir();
      const databaseUrl = `file:${join(tempDir, 'test.db')}`;
      const schemaPath = join(tempDir, 'schema.prisma');
      const configPath = join(tempDir, 'prisma.config.ts');
      const clientOutput = join(tempDir, 'generated-client');
      const prismaClientPackageDir = dirname(
        require.resolve('@prisma/client/package.json')
      );

      mkdirSync(join(tempDir, 'node_modules', '@prisma'), { recursive: true });
      symlinkSync(
        prismaClientPackageDir,
        join(tempDir, 'node_modules', '@prisma', 'client'),
        'dir'
      );

      writeFileSync(
        schemaPath,
        `generator client {
  provider = "prisma-client-js"
  output   = "${clientOutput.replace(/\\/g, '/')}"
}

datasource db {
  provider = "sqlite"
}

model PermifyRole {
  id          String   @id @default(cuid())
  name        String   @unique
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  permissions PermifyRoleHasPermission[]
  models      PermifyModelHasRole[]

  @@map("roles")
}

model PermifyPermission {
  id        String   @id @default(cuid())
  name      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  roles  PermifyRoleHasPermission[]
  models PermifyModelHasPermission[]

  @@map("permissions")
}

model PermifyRoleHasPermission {
  roleId       String
  permissionId String

  role       PermifyRole       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission PermifyPermission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@map("role_has_permissions")
}

model PermifyModelHasRole {
  modelId   String
  modelType String
  roleId    String

  role PermifyRole @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([modelId, modelType, roleId])
  @@map("model_has_roles")
}

model PermifyModelHasPermission {
  modelId      String
  modelType    String
  permissionId String

  permission PermifyPermission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([modelId, modelType, permissionId])
  @@map("model_has_permissions")
}
`
      );

      writeFileSync(
        configPath,
        `import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './schema.prisma',
  datasource: {
    url: '${databaseUrl.replace(/\\/g, '/')}',
  },
});
`
      );

      const execOptions = {
        cwd: packageDir,
        env: process.env,
        stdio: 'pipe' as const,
      };

      execFileSync(
        'pnpm',
        [
          'exec',
          'prisma',
          'generate',
          '--schema',
          schemaPath,
          '--config',
          configPath,
        ],
        execOptions
      );
      const sqlite = new DatabaseSync(join(tempDir, 'test.db'));
      sqlite.exec(`
      CREATE TABLE roles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE permissions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE role_has_permissions (
        roleId TEXT NOT NULL,
        permissionId TEXT NOT NULL,
        PRIMARY KEY (roleId, permissionId)
      );

      CREATE TABLE model_has_roles (
        modelId TEXT NOT NULL,
        modelType TEXT NOT NULL,
        roleId TEXT NOT NULL,
        PRIMARY KEY (modelId, modelType, roleId)
      );

      CREATE TABLE model_has_permissions (
        modelId TEXT NOT NULL,
        modelType TEXT NOT NULL,
        permissionId TEXT NOT NULL,
        PRIMARY KEY (modelId, modelType, permissionId)
      );
    `);
      sqlite.close();

      const { PrismaClient } = await import(
        pathToFileURL(join(clientOutput, 'index.js')).href
      );

      const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
      const prisma = new PrismaClient({ adapter });

      try {
        const [
          adminRole,
          editorRole,
          createPermission,
          editPermission,
          publishPermission,
          archivePermission,
          managePermission,
        ] =
          await Promise.all([
            prisma.permifyRole.create({ data: { name: 'admin' } }),
            prisma.permifyRole.create({ data: { name: 'editor' } }),
            prisma.permifyPermission.create({ data: { name: 'post.create' } }),
            prisma.permifyPermission.create({ data: { name: 'post.edit' } }),
            prisma.permifyPermission.create({ data: { name: 'post.publish' } }),
            prisma.permifyPermission.create({ data: { name: 'post.archive' } }),
            prisma.permifyPermission.create({ data: { name: 'team.manage' } }),
          ]);

        await prisma.permifyRoleHasPermission.createMany({
          data: [
            { roleId: adminRole.id, permissionId: createPermission.id },
            { roleId: adminRole.id, permissionId: editPermission.id },
            { roleId: editorRole.id, permissionId: publishPermission.id },
          ],
        });

        const resolver = createPrismaResolver(prisma as any);
        const writeResolver = createPrismaWriteResolver(prisma as any);

        await writeResolver.assignRole({ id: 'user-1' }, 'admin');
        await writeResolver.assignRole({ id: 'user-1' }, 'admin');
        await writeResolver.givePermissionTo({ id: 'user-1' }, 'post.publish');
        await writeResolver.givePermissionTo({ id: 'user-1' }, 'post.publish');
        await writeResolver.assignRole({ id: 'team-1', modelType: 'Team' }, 'editor');
        await writeResolver.givePermissionTo(
          { id: 'team-1', modelType: 'Team' },
          'team.manage'
        );

        expect(await resolver.getRoles({ id: 'user-1' })).toEqual(['admin']);
        expect(await resolver.getDirectPermissions({ id: 'user-1' })).toEqual([
          'post.publish',
        ]);
        expect(
          await resolver.getPermissionsThroughRoles({ id: 'user-1' })
        ).toEqual(expect.arrayContaining(['post.create', 'post.edit']));
        expect(await resolver.getRolePermissions('admin')).toEqual(
          expect.arrayContaining(['post.create', 'post.edit'])
        );
        expect(
          await prisma.permifyModelHasRole.count({
            where: { modelId: 'user-1', modelType: 'User' },
          })
        ).toBe(1);
        expect(
          await prisma.permifyModelHasPermission.count({
            where: { modelId: 'user-1', modelType: 'User' },
          })
        ).toBe(1);
        expect(await resolver.getRoles({ id: 'team-1', modelType: 'Team' })).toEqual([
          'editor',
        ]);
        expect(
          await resolver.getDirectPermissions({ id: 'team-1', modelType: 'Team' })
        ).toEqual(['team.manage']);
        expect(await resolver.getRoles({ id: 'team-1' })).toEqual([]);

        await writeResolver.syncRoles({ id: 'user-1' }, ['editor']);
        await writeResolver.syncPermissions({ id: 'user-1' }, ['post.create']);
        await writeResolver.assignPermissionToRole('editor', 'post.archive');
        await writeResolver.assignPermissionToRole('editor', 'post.archive');

        expect(await resolver.getRoles({ id: 'user-1' })).toEqual(['editor']);
        expect(await resolver.getDirectPermissions({ id: 'user-1' })).toEqual([
          'post.create',
        ]);
        expect(await resolver.getPermissionsThroughRoles({ id: 'user-1' })).toEqual(
          expect.arrayContaining(['post.publish', 'post.archive'])
        );
        expect(await resolver.getRolePermissions('editor')).toEqual(
          expect.arrayContaining(['post.publish', 'post.archive'])
        );

        await writeResolver.removeRole({ id: 'user-1' }, 'editor');
        await writeResolver.revokePermissionTo({ id: 'user-1' }, 'post.create');
        expect(await resolver.getRoles({ id: 'user-1' })).toEqual([]);
        expect(await resolver.getDirectPermissions({ id: 'user-1' })).toEqual([]);

        await writeResolver.assignRole({ id: 'user-1' }, 'admin');
        await writeResolver.givePermissionTo({ id: 'user-1' }, 'post.publish');
        await writeResolver.revokePermissionFromRole('admin', 'post.edit');
        expect(await resolver.getRolePermissions('admin')).toEqual(['post.create']);

        await writeResolver.syncRolePermissions('admin', ['post.archive', 'post.edit']);
        expect(await resolver.getRolePermissions('admin')).toEqual(
          expect.arrayContaining(['post.archive', 'post.edit'])
        );
        expect(await resolver.getPermissionsThroughRoles({ id: 'user-1' })).toEqual(
          expect.arrayContaining(['post.archive', 'post.edit'])
        );
        expect(await resolver.getPermissionsThroughRoles({ id: 'team-1', modelType: 'Team' }))
          .toEqual(['post.publish', 'post.archive']);
        expect(publishPermission.name).toBe('post.publish');
        expect(archivePermission.name).toBe('post.archive');
        expect(managePermission.name).toBe('team.manage');
      } finally {
        await prisma.$disconnect();
      }
    },
    60000
  );
});

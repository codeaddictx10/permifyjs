import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const tempDirs: string[] = [];
const originalCwd = process.cwd();
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

function createTempProject(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'permifyjs-cli-'));
  tempDirs.push(cwd);
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'test-app' }));
  return cwd;
}

function getOutput(): string {
  return consoleLogSpy.mock.calls
    .flatMap((call) => call.map((value) => String(value)))
    .join('\n')
    .replace(/\u001B\[[0-9;]*m/g, '');
}

describe('CLI command flows', () => {
  beforeEach(() => {
    consoleLogSpy.mockClear();
  });

  afterEach(() => {
    process.chdir(originalCwd);

    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  it('parses role assignment commands with an explicit model type', async () => {
    const cwd = createTempProject();
    process.chdir(cwd);

    const { createProgram } = await import('../cli/program');
    const program = createProgram().exitOverride();
    await program.parseAsync(
      ['node', 'permifyjs', 'role:assign', '--model-id', '42', '--model-type', 'Admin', '--role', 'editor'],
      { from: 'node' }
    );

    const output = getOutput();
    expect(output).toContain('role:assign');
    expect(output).toContain('Assigning role editor to Admin:42');
    expect(output).toContain('Use auth.assignRole(), auth.removeRole() in your app code');
  });

  it('parses permission assignment commands', async () => {
    const cwd = createTempProject();
    process.chdir(cwd);

    const { createProgram } = await import('../cli/program');
    const program = createProgram().exitOverride();
    await program.parseAsync(
      ['node', 'permifyjs', 'permission:assign', '--role', 'admin', '--permission', 'post.publish'],
      { from: 'node' }
    );

    const output = getOutput();
    expect(output).toContain('Assigning permission post.publish to role admin');
    expect(output).toContain('Use auth.assignPermissionToRole() in your app code');
  });

  it('uses the default model type for user permissions inspection', async () => {
    const cwd = createTempProject();
    process.chdir(cwd);

    const { createProgram } = await import('../cli/program');
    const program = createProgram().exitOverride();
    await program.parseAsync(
      ['node', 'permifyjs', 'user:permissions', '--model-id', '7'],
      { from: 'node' }
    );

    const output = getOutput();
    expect(output).toContain('Permissions for User:7');
    expect(output).toContain('Use auth.getAllPermissions() in your app');
  });
});

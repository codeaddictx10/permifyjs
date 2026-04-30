import { execa } from 'execa';
import type { PackageManager } from './detect';
import process from 'node:process';

export async function installPackages(
  packages: string[],
  packageManager: PackageManager,
  dev = false
): Promise<void> {
  const commands: Record<PackageManager, string[]> = {
    pnpm: ['pnpm', 'add', ...(dev ? ['-D'] : []), ...packages],
    yarn: ['yarn', 'add', ...(dev ? ['--dev'] : []), ...packages],
    npm: ['npm', 'install', ...(dev ? ['--save-dev'] : ['--save']), ...packages],
  };

  const [cmd, ...args] = commands[packageManager];
  await execa(cmd, args, { stdio: 'inherit', cwd: process.cwd() });
}

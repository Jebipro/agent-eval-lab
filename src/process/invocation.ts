import { access, readFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path';

// Resolve only for the Windows batch boundary; ordinary executable lookup stays
// with cross-spawn. No user arguments are interpolated into a shell command.
export async function invocation(command: string, args: string[], cwd: string): Promise<{ command: string; args: string[] }> {
  if (process.platform !== 'win32') return { command, args };
  const directories = /[\\/]/.test(command) || isAbsolute(command) ? [''] : [cwd, ...(process.env.PATH ?? '').split(';').map(p => p.replace(/^"|"$/g, ''))];
  const extensions = extname(command) ? [''] : (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';');
  let file: string | undefined;
  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = resolve(cwd, directory, command + extension);
      if (await access(candidate).then(() => true, () => false)) { file = candidate; break; }
    }
    if (file) break;
  }
  if (!file || !/\.(cmd|bat)$/i.test(file)) return { command, args };
  if (/^npm\.cmd$/i.test(basename(file))) {
    const packageRoot = join(dirname(file), 'node_modules/npm');
    const entry = join(packageRoot, 'bin/npm-cli.js');
    try {
      const pkg = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')) as { name?: string };
      if (pkg.name !== 'npm') throw new Error('Not an npm installation');
      await access(entry);
      return { command: process.execPath, args: [entry, ...args] };
    } catch { throw new Error(`Cannot safely invoke npm shim ${file}. Configure the installed node executable and npm-cli.js explicitly.`); }
  }
  if (args.some(arg => /["&|<>^%!()\r\n]/.test(arg))) throw new Error(`Cannot safely pass shell metacharacters to Windows batch command ${file}. Configure an executable and literal arguments instead.`);
  return { command: file, args };
}

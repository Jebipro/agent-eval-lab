import { spawn, type ChildProcess } from 'node:child_process';
import { isAbsolute, join } from 'node:path';

const exited = (child: ChildProcess) => child.exitCode !== null || child.signalCode !== null;
async function waitForExit(child: ChildProcess): Promise<boolean> {
  if (exited(child)) return true;
  return new Promise(resolve => {
    const finish = () => { clearTimeout(timer); child.removeListener('exit', onExit); resolve(exited(child)); };
    const onExit = () => finish();
    const timer = setTimeout(finish, 1000);
    child.once('exit', onExit);
  });
}
export async function terminate(child: ChildProcess): Promise<string | null> {
  if (!child.pid) return null;
  let failure: string | null = null;
  if (process.platform === 'win32') {
    const systemRoot = process.env.SystemRoot ?? process.env.windir;
    if (!systemRoot || !isAbsolute(systemRoot)) failure = 'Windows SystemRoot is unavailable';
    else failure = await new Promise<string | null>(resolve => {
      const killer = spawn(join(systemRoot, 'System32/taskkill.exe'), ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      let finished = false;
      const done = (message: string | null) => { if (finished) return; finished = true; clearTimeout(timer); resolve(message); };
      const timer = setTimeout(() => {
        let helperStopped = false;
        try { helperStopped = killer.kill(); } catch { /* Report uncertainty below. */ }
        killer.unref();
        done(`taskkill exceeded its 2 second cleanup deadline${helperStopped ? '' : '; cleanup helper termination NOT confirmed'}`);
      }, 2000);
      killer.once('error', error => done(`taskkill could not start: ${error.message}`));
      killer.once('close', code => done(code === 0 ? null : `taskkill exited with code ${code}`));
    });
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') failure = `Process group termination failed: ${String(error)}`; }
  }
  if (!failure && await waitForExit(child)) return null;
  let fallbackFailure: string | null = null;
  if (!exited(child)) {
    try { if (!child.kill('SIGKILL')) fallbackFailure = 'Direct child termination was not accepted'; }
    catch (error) { fallbackFailure = `Direct child termination failed: ${String(error)}`; }
  }
  const stopped = await waitForExit(child);
  if (!stopped) return `${failure ?? fallbackFailure ?? 'Termination was requested'}; direct child termination NOT confirmed (pid ${child.pid}); descendants may remain`;
  return failure ? `${failure}; direct child exited, but process tree cleanup NOT confirmed` : null;
}

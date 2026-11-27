import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export function workerLaunch(entry, env, platform = process.platform) {
  if (platform !== 'win32') return {
    command: process.execPath, args: [entry], options: { env, detached: true },
  };
  // No shell interpolation, profile, ExecutionPolicy bypass, or PATH lookup.
  if (!process.env.SystemRoot) throw new Error('SystemRoot is required for Windows worker ownership');
  return {
    command: win32.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    // PowerShell must not consume/wait for the MCP stdin stream as pipeline
    // input before invoking the guard. The native worker owns those bytes.
    args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-InputFormat', 'None', '-Command',
      "$ErrorActionPreference='Stop'; if ($env:UI_CRAFT_WORKER_DIAGNOSTICS -eq '1') { [Console]::Error.WriteLine('guard-script-entered') }; Add-Type -LiteralPath $env:UI_CRAFT_WORKER_HELPER; if ($env:UI_CRAFT_WORKER_DIAGNOSTICS -eq '1') { [Console]::Error.WriteLine('guard-helper-compiled') }; [UICraftJob]::Run()"],
    options: { windowsHide: true, env: {
      ...env, SystemRoot: process.env.SystemRoot,
      UI_CRAFT_WORKER_NODE: process.execPath, UI_CRAFT_WORKER_ENTRY: entry,
      UI_CRAFT_WORKER_HELPER: fileURLToPath(new URL('./windows-job.cs', import.meta.url)),
      UI_CRAFT_WORKER_PARENT: String(process.pid), UI_CRAFT_WORKER_STOP: join(env.TMPDIR, 'stop'),
    } },
  };
}

export function spawnWorker(entry, env) {
  const launch = workerLaunch(entry, env);
  return spawn(launch.command, launch.args, { ...launch.options,
    cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] });
}

export async function stopWorker(child, exited, env) {
  if (process.platform === 'win32') {
    // The guard acknowledges by exiting only after QueryInformationJobObject
    // reports zero active processes. Preserve the job directory on failure.
    await writeFile(join(env.TMPDIR, 'stop'), 'stop', { flag: 'w' });
    const result = await Promise.race([exited, delay(15000).then(() => 'timeout')]);
    if (result === 'timeout') {
      child.kill('SIGKILL'); // Closing the guard's handle is the fail-safe.
      throw new Error('Windows worker cleanup was not acknowledged; profile retained');
    }
    if (result !== 0) throw new Error('Windows worker guard failed; profile retained');
    return;
  }
  const kill = signal => {
    try { process.kill(-child.pid, signal); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  kill('SIGTERM');
  await delay(250);
  kill('SIGKILL');
  await Promise.race([exited, delay(1000)]);
  for (let i = 0; i < 20; i++) {
    try { process.kill(-child.pid, 0); }
    catch (error) { if (error.code === 'ESRCH') return; throw error; }
    await delay(50);
  }
  throw new Error('Owned worker process group did not exit after SIGKILL');
}

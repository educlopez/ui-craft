import { Client } from '@modelcontextprotocol/client';
import { getDefaultEnvironment } from '@modelcontextprotocol/client/stdio';
import { spawnWorker, stopWorker } from './process-owner.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const active = new Set();
let rendering = false;
let shutdownInstalled = false;
let cleanupFailed = false;

function installShutdown() {
  if (shutdownInstalled) return;
  shutdownInstalled = true;
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    const jobs = [...active];
    for (const job of jobs) job.abort();
    const deadline = setTimeout(async () => {
      await Promise.allSettled(jobs.map(job => job.transport?.close()));
      process.exit(1);
    }, process.platform === 'win32' ? 17000 : 1500);
    Promise.allSettled(jobs.map(job => job.finished)).then(() => {
      clearTimeout(deadline);
      process.exit(cleanupFailed ? 1 : 0);
    });
  });
}

// A private transport owns a POSIX group or Windows Job Object. Closing the SDK
// transport alone could kill Node but leave its Chrome descendants running.
class OwnedTransport {
  constructor(entry, env, onSpawn) {
    this.entry = entry;
    this.env = env;
    this.onSpawn = onSpawn;
    this.buffer = '';
  }

  async start() {
    if (this.child) throw new Error('Worker transport already started');
    this.child = spawnWorker(this.entry, this.env);
    const child = this.child;
    this.exited = new Promise(resolve => {
      child.once('exit', code => resolve(code));
      child.once('error', () => resolve(-1));
    });
    child.once('error', error => { this.onerror?.(error); this.onclose?.(); });
    child.once('exit', () => this.onclose?.());
    for (const stream of [child.stdin, child.stdout, child.stderr]) {
      stream.on('error', error => this.onerror?.(error));
    }
    child.stderr.on('data', () => {}); // Drain diagnostics; never echo code/URLs.
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      this.buffer += chunk;
      if (Buffer.byteLength(this.buffer) > 10 * 1024 * 1024) {
        this.onerror?.(new Error('Worker response exceeds 10 MB'));
        void this.close().catch(error => this.onerror?.(error));
        return;
      }
      let newline;
      while ((newline = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, newline);
        this.buffer = this.buffer.slice(newline + 1);
        try { if (line.trim()) this.onmessage?.(JSON.parse(line)); }
        catch (error) { this.onerror?.(error); void this.close().catch(error => this.onerror?.(error)); }
      }
    });
    await new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    this.onSpawn?.(child.pid);
  }

  async send(message) {
    await new Promise((resolve, reject) => {
      this.child.stdin.write(`${JSON.stringify(message)}\n`, error => error ? reject(error) : resolve());
    });
  }

  close() {
    if (this.closing) return this.closing;
    this.closing = this.stop();
    return this.closing;
  }

  async stop() {
    const pid = this.child?.pid;
    if (!pid) return;
    await stopWorker(this.child, this.exited, this.env);
    this.child.stdin.destroy();
    this.child.stdout.destroy();
    this.child.stderr.destroy();
  }
}

export async function runTool(name, args, request, options = {}) {
  if (cleanupFailed) throw new Error('Worker cleanup could not be verified; inspect owned processes before restarting this server');
  if (active.size >= 2 || (name === 'check_fold' && rendering)) {
    throw new Error('UI Craft busy; retry after the current check finishes');
  }
  const token = {};
  installShutdown();
  token.finished = new Promise(resolve => { token.finish = resolve; });
  active.add(token);
  const isRender = name === 'check_fold';
  if (isRender) rendering = true;
  let directory, client, transport, timer, heartbeat;
  const controller = new AbortController();
  token.abort = () => controller.abort(new Error('UI Craft server is shutting down'));
  const forwardAbort = () => controller.abort(request?.signal?.reason ?? new Error('Client cancelled the check'));
  request?.signal?.addEventListener('abort', forwardAbort, { once: true });
  if (request?.signal?.aborted) forwardAbort();
  const started = Date.now();
  let progress = 0;
  const report = async message => {
    if (request?._meta?.progressToken !== undefined && !controller.signal.aborted) {
      // stdout backpressure is not abortable in the SDK. Stop waiting on it
      // when the request/deadline aborts, so finally can still own cleanup.
      // Keep rejection handlers attached even if the send settles much later.
      await new Promise((resolve, reject) => {
        const signal = controller.signal;
        const aborted = () => {
          signal.removeEventListener('abort', aborted);
          reject(signal.reason);
        };
        signal.addEventListener('abort', aborted, { once: true });
        Promise.resolve().then(() => {
          signal.throwIfAborted();
          return request.notify({ method: 'notifications/progress', params: {
            progressToken: request._meta.progressToken, progress: progress++, message,
          } });
        }).then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
      });
    }
  };
  const audit = (event, pid) => {
    const record = { component: 'ui-craft-worker', event, tool: name, ...(pid ? { pid } : {}) };
    console.error(JSON.stringify(record));
    options.onEvent?.(record);
  };
  let completed = false;
  try {
    controller.signal.throwIfAborted();
    const budget = options.timeoutMs ?? (isRender ? 60_000 : 30_000);
    if (!Number.isFinite(budget) || budget < 100 || budget > 60_000) throw new Error('Invalid worker time budget');
    timer = setTimeout(() => controller.abort(new Error('UI Craft check exceeded its hard time limit')), budget);
    directory = await mkdtemp(join(options.tempRoot ?? tmpdir(), 'ui-craft-job-'));
    controller.signal.throwIfAborted();
    const env = {
      ...getDefaultEnvironment(),
      TMPDIR: directory, TMP: directory, TEMP: directory,
      UI_CRAFT_MCP_TOOL_WORKER: '1', UI_CRAFT_MCP_SKILLS: '0',
      ...(process.env.UI_CRAFT_CHROME ? { UI_CRAFT_CHROME: process.env.UI_CRAFT_CHROME } : {}),
    };
    transport = new OwnedTransport(options.entry ?? fileURLToPath(import.meta.url), env,
      pid => audit('started', pid));
    token.transport = transport;
    // The bundle supplies its own entry below; source imports use an explicit
    // fixture entry in tests. No API key or Claude credential is inherited.
    client = new Client({ name: 'ui-craft-owned-worker', version: '0.0.0-local' });
    await report('Starting isolated check');
    await client.connect(transport, { signal: controller.signal, timeout: Math.min(budget, process.platform === 'win32' ? 15000 : 5000) });
    await report(isRender ? 'Rendering page in an isolated browser worker' : 'Running isolated check');
    let pending = Promise.resolve();
    heartbeat = setInterval(() => {
      pending = pending.then(() => report(`Check still running (${Math.floor((Date.now() - started) / 1000)}s elapsed)`))
        .catch(() => {});
    }, 1000);
    const result = await client.callTool({ name, arguments: args }, {
      signal: controller.signal, timeout: budget,
    });
    clearInterval(heartbeat);
    await pending;
    controller.signal.throwIfAborted();
    await report(result.isError ? 'Check returned an error' : 'Check completed');
    completed = true;
    return result;
  } finally {
    clearTimeout(timer);
    clearInterval(heartbeat);
    request?.signal?.removeEventListener('abort', forwardAbort);
    // The worker group's hard stop is independent of SDK request cancellation.
    try {
      await transport?.close();
      await client?.close();
      if (directory) await rm(directory, { recursive: true, force: true });
      audit(controller.signal.aborted ? 'cancelled-and-cleaned' : completed ? 'completed-and-cleaned' : 'failed-and-cleaned', transport?.child?.pid);
    } catch (error) {
      // Do not launch another browser if a previous owned tree could remain.
      cleanupFailed = true;
      throw error;
    } finally {
      active.delete(token);
      if (isRender) rendering = false;
      token.finish();
    }
  }
}

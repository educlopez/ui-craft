/**
 * browser.mjs — drive a browser the user already has, with no dependencies.
 *
 * Every published option for this costs something: puppeteer downloads ~300MB
 * of Chromium, puppeteer-core and chrome-launcher are smaller but still ship a
 * dependency tree into a project whose whole pitch is a static binary and no
 * Node at install time.
 *
 * Chrome speaks the DevTools Protocol over a WebSocket, and Node has had a
 * global WebSocket for years. So this drives the browser directly: find the
 * one that is already installed, start it headless on an ephemeral port, talk
 * to it, and shut it down. No install step, nothing to keep updated.
 *
 * puppeteer is still honoured when present — see measureFold — so nobody who
 * already set it up has to change anything.
 */

import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { platform } from 'node:process';

/** Browsers that speak CDP, in the order a user most likely wants one picked. */
const CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Arc.app/Contents/MacOS/Arc',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
    '/usr/bin/brave-browser',
    '/snap/bin/chromium',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  ],
};

/**
 * Locate an installed CDP-capable browser.
 * `UI_CRAFT_CHROME` wins when set, so anyone with a browser somewhere unusual
 * (or who wants a specific channel) can say so once.
 *
 * @param {{ env?: Record<string,string|undefined>, exists?: (p: string) => boolean, os?: string }} [deps]
 * @returns {string|null} executable path, or null when none is installed
 */
export function findBrowser(deps = {}) {
  const env = deps.env ?? process.env;
  const exists = deps.exists ?? existsSync;
  const os = deps.os ?? platform;

  const explicit = env.UI_CRAFT_CHROME;
  if (explicit) return exists(explicit) ? explicit : null;

  for (const path of CANDIDATES[os] ?? []) {
    if (exists(path)) return path;
  }
  return null;
}

/** Human-readable reason, used when there is nothing to drive. */
/**
 * Whether a failure means "no browser to drive" rather than "the browser found a problem".
 *
 * Lives here, beside the messages it describes, so a third reason updates one place. A test
 * that string-matched only the missing-executable message skipped correctly on a laptop and
 * treated CI's Node-20 WebSocket gap as a real failure — and would equally have treated a
 * navigation regression as a skip, which is the more expensive direction.
 */
export function isBrowserUnavailable(message) {
  const m = String(message ?? '');
  return /No Chrome-family browser found/.test(m) || /has no global WebSocket/.test(m);
}

export function noBrowserMessage() {
  return (
    'No Chrome-family browser found. check_fold measures a rendered page, so it needs one. ' +
    'Install Chrome, Chromium, Edge or Brave, or set UI_CRAFT_CHROME to an executable. ' +
    'An existing puppeteer install is used automatically if you have one.'
  );
}

const CDP_FLAGS = [
  '--headless=new',
  '--remote-debugging-port=0',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--disable-extensions',
  '--disable-gpu',
  '--hide-scrollbars',
  '--mute-audio',
  // Chrome resolves `localhost` to ::1 first, while most dev servers bind only
  // to 127.0.0.1 — so the page a developer is looking at is unreachable from
  // headless unless the resolution is pinned. This is the single most common
  // way a fold measurement silently ends up describing an error page.
  '--host-resolver-rules=MAP localhost 127.0.0.1',
];

function waitForEndpoint(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error('browser did not report a DevTools endpoint in time')), timeoutMs);
    const onData = (chunk) => {
      buffer += chunk.toString();
      const match = /ws:\/\/[^\s]+/.exec(buffer);
      if (match) {
        clearTimeout(timer);
        child.stderr.off('data', onData);
        resolve(match[0]);
      }
    };
    child.stderr.on('data', onData);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`browser exited before it was ready (code ${code})`));
    });
  });
}

/**
 * A minimal CDP client: correlate replies by id, dispatch events by method.
 */
function connect(endpoint) {
  if (typeof WebSocket === 'undefined') {
    throw new Error('This Node build has no global WebSocket. Node 22 or newer is required to drive a browser without puppeteer.');
  }
  const ws = new WebSocket(endpoint);
  const pending = new Map();
  const waiters = new Map();
  let nextId = 0;

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      return;
    }
    const waiting = waiters.get(msg.method);
    if (waiting) {
      waiters.delete(msg.method);
      waiting(msg.params);
    }
  });

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error(`could not connect to ${endpoint}`)), { once: true });
  });

  return {
    ready,
    send(method, params = {}, sessionId) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    once(method, timeoutMs) {
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          waiters.delete(method);
          resolve(null); // a page that never fires load is still worth measuring
        }, timeoutMs);
        waiters.set(method, (params) => {
          clearTimeout(timer);
          resolve(params);
        });
      });
    },
    close: () => ws.close(),
  };
}

/**
 * Render a URL in an installed browser and hand the page to `visit`.
 *
 * @param {string} url
 * @param {{ width?: number, height?: number, timeoutMs?: number, executablePath?: string }} opts
 * @param {(page: { evaluate: (expr: string) => Promise<any>, screenshot: () => Promise<string> }) => Promise<any>} visit
 */
export async function withPage(url, opts, visit) {
  const exe = opts.executablePath ?? findBrowser();
  if (!exe) throw new Error(noBrowserMessage());

  const timeoutMs = opts.timeoutMs ?? 30000;
  const profile = await mkdtemp(join(tmpdir(), 'ui-craft-fold-'));
  const child = spawn(exe, [...CDP_FLAGS, `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });

  let client;
  try {
    const endpoint = await waitForEndpoint(child, timeoutMs);
    client = connect(endpoint);
    await client.ready;

    const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });

    await client.send('Page.enable', {}, sessionId);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: opts.width ?? 1440,
      height: opts.height ?? 900,
      deviceScaleFactor: 1,
      mobile: false,
    }, sessionId);

    const loaded = client.once('Page.loadEventFired', timeoutMs);
    const nav = await client.send('Page.navigate', { url }, sessionId);
    // Chrome renders its own error page on a failed navigation, and that page
    // measures perfectly well: a few text nodes, no visual, high confidence,
    // entirely wrong. Refusing here is the difference between a tool that is
    // unavailable and one that lies.
    if (nav?.errorText) {
      throw new Error(`could not load ${url} — ${nav.errorText}. The page must be reachable from a fresh browser profile.`);
    }
    await loaded;
    // Let late layout — webfonts, hydration — settle before measuring geometry.
    await new Promise((r) => setTimeout(r, opts.settleMs ?? 600));

    return await visit({
      async evaluate(expression) {
        const res = await client.send('Runtime.evaluate', {
          expression,
          returnByValue: true,
          awaitPromise: true,
        }, sessionId);
        if (res.exceptionDetails) throw new Error(res.exceptionDetails.text ?? 'evaluation failed in the page');
        return res.result?.value;
      },
      async screenshot() {
        const res = await client.send('Page.captureScreenshot', { format: 'png' }, sessionId);
        return res.data;
      },
    });
  } finally {
    try { client?.close(); } catch {}
    child.kill();
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}

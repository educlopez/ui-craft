/**
 * experiments.mjs — the agent setups a build eval can be run against.
 *
 * An experiment answers one question: what does the agent have available? The eval and the
 * scorer stay identical across experiments, so any difference in the result is attributable
 * to the setup — that is the whole point of running more than one.
 *
 * `no-skill` is the arm that matters. ui-craft's own writing-skills rubric says a line
 * earns its place only if removing it changes the output, and until now the only way to
 * test that was to read the skill and imagine. An arm without it turns that into a diff.
 *
 * KNOWN LIMIT, stated because a silent one would make the contrast look cleaner than it is:
 * `no-skill` blocks the Skill tool, so the agent cannot pull ui-craft's body. It does NOT
 * remove the skill's name and description from the system prompt, which the harness injects
 * for discovery. So the arm measures "instructions unavailable", not "skill absent". A true
 * absent arm needs an isolated HOME, which breaks CLI auth; not worth it for the signal.
 *
 * Zero external dependencies. Node 18+.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';

const DRIVER = 'claude';

// Enough to build a real surface, nothing that reaches the network or the user's machine
// beyond the sandbox directory.
const BUILD_TOOLS = ['Write', 'Edit', 'Read', 'Glob', 'Grep', 'Bash', 'TodoWrite'];

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MCP_SERVER = path.join(REPO_ROOT, 'mcp', 'src', 'server.mjs');

/**
 * The tools the MCP server registers, spelled as the driver sees them.
 *
 * Enumerated rather than wildcarded so that adding a tool to the server without deciding
 * whether evals should reach it is a test failure, not a silent omission. That omission is
 * exactly what this arm exists to correct: every recorded build was captured with no
 * ui-craft MCP tool in the allowlist at all, so the gates, the router and the fold draw had
 * never once run inside an eval.
 */
export const MCP_TOOLS = [
  'route_task',
  'check_anti_slop',
  'tokens_lint',
  'acceptance_bar',
  'score_ui',
  'fold_candidates',
  'check_fold',
].map((t) => `mcp__ui-craft__${t}`);

/**
 * Drive the headless CLI in `workspace` and return everything it said.
 *
 * The transcript is the return value, not a side effect: half of what a build eval scores
 * (did the Craft Read appear, in the prescribed shape, before the code) exists only here.
 */
function runClaude({ prompt, workspace, allowSkill, allowMcp = false, model, timeoutMs, streamTo }) {
  // stream-json, not text. `--output-format text` emits only the FINAL message, and the
  // Craft Read is emitted mid-run, before the first file is written — so a text run scores
  // an empty transcript and fails every transcript check for the wrong reason. The stream
  // also carries tool_use events in order, which is the only way to check "before code"
  // rather than "somewhere in the output".
  const args = [
    '-p',
    prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    '--permission-mode',
    'acceptEdits',
    '--allowedTools',
    [...BUILD_TOOLS, ...(allowSkill ? ['Skill'] : []), ...(allowMcp ? MCP_TOOLS : [])].join(','),
  ];
  if (!allowSkill) args.push('--disallowedTools', 'Skill');
  if (model) args.push('--model', model);

  // The MCP config is written to a temp dir, not into the workspace: the workspace is the
  // artifact a scorer reads, and a config file dropped in it would be scored as something
  // the agent produced.
  let mcpDir = null;
  if (allowMcp) {
    mcpDir = mkdtempSync(path.join(os.tmpdir(), 'ui-craft-eval-mcp-'));
    const cfg = path.join(mcpDir, 'mcp.json');
    // The server from this checkout, not the published package: an eval measures what is
    // about to ship, and reaching npm would make the run depend on the network.
    writeFileSync(cfg, JSON.stringify({ mcpServers: { 'ui-craft': { command: 'node', args: [MCP_SERVER] } } }));
    args.push('--mcp-config', cfg);
  }

  return new Promise((resolve) => {
    // stdin is closed, not inherited. Left open, the driver waits on it and warns
    // "no stdin data received in 3s" before proceeding — a stall on every single run.
    const child = spawn(DRIVER, args, { cwd: workspace, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });

    let raw = '';
    let err = '';
    // Mirror the stream to disk as it arrives, not at the end. A run killed mid-flight —
    // by a timeout, a stopped background job, a laptop lid — left a fully built workspace
    // and no record of anything the agent said, so the half of the eval that lives in the
    // transcript was unrecoverable while the expensive half survived. Appending costs
    // nothing and makes a partial run still worth scoring.
    const sink = streamTo ? createWriteStream(streamTo, { flags: 'a' }) : null;

    // Teardown is tied to the child exiting, not to resolving. The two are not the same
    // event: the timeout resolves while the process is still alive, so tearing down there
    // ended the sink under stdout that was still arriving and removed the MCP config out
    // from under a server that had not stopped reading it.
    let torn = false;
    const teardown = () => {
      if (torn) return;
      torn = true;
      sink?.end();
      if (mcpDir) {
        try {
          rmSync(mcpDir, { recursive: true, force: true });
        } catch {
          // A leftover temp dir is not worth failing a build eval over.
        }
        mcpDir = null;
      }
    };

    // Resolve exactly once. A timed-out child still emits `close` when the signal lands, and
    // without this the second resolve would silently discard the first result.
    let settled = false;
    const settle = (payload) => {
      if (settled) return;
      settled = true;
      resolve(payload);
    };

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      // Report now; clean up when the process actually goes. If it ignores SIGTERM entirely
      // the fallback below still frees the config rather than leaking it for the session.
      setTimeout(teardown, 5000).unref();
      settle({
        ...parseStream(raw),
        raw,
        stderr: `${err}\n[harness] timed out`,
        timedOut: true,
      });
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      raw += d;
      if (!torn) sink?.write(d);
    });
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      err += `\n[harness] driver failed to start: ${e.message}`;
      teardown();
      settle({ ...parseStream(raw), raw, stderr: err });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      teardown();
      settle({ ...parseStream(raw), raw, stderr: err, code });
    });
  });
}

/**
 * Fold the NDJSON stream into what a scorer needs.
 *
 * `transcript` is everything the agent said. `preCode` is only what it said before its
 * first Write/Edit — the distinction the checklist actually asks about, since a Craft Read
 * produced after the files exist is a summary, not a decision.
 *
 * A malformed line is skipped rather than fatal: a truncated stream from a timeout should
 * still score whatever arrived.
 */
export function parseStream(raw) {
  const texts = [];
  const preTexts = [];
  const toolUses = [];
  // Which reference files the build actually opened, in order. The skill labels seven refs
  // "required before writing UI", and whether a passing build reads all seven is an
  // empirical question the harness can answer instead of a judgement call about tiering.
  const refsRead = [];
  let sawWrite = false;

  for (const line of String(raw).split('\n')) {
    const t = line.trim();
    if (!t.startsWith('{')) continue;
    let msg;
    try {
      msg = JSON.parse(t);
    } catch {
      continue;
    }
    // Assistant turns only. Tool results ride in `user`-role messages, and a Skill call
    // returns the skill's own body — so folding those in makes the transcript contain the
    // rules being measured. A "Craft Read emitted" check then passes by matching SKILL.md's
    // instruction to emit one, which is worse than a false negative: it reports the gate
    // working while measuring nothing.
    const role = msg?.message?.role ?? msg?.type;
    if (role !== 'assistant') continue;
    const blocks = msg?.message?.content;
    if (!Array.isArray(blocks)) continue;
    for (const b of blocks) {
      if (b?.type === 'text' && typeof b.text === 'string') {
        texts.push(b.text);
        if (!sawWrite) preTexts.push(b.text);
      } else if (b?.type === 'tool_use') {
        toolUses.push(b.name);
        // A ref counts as read only if it was opened BEFORE the first write. Opening
        // layout.md to check something after the components exist is not "required reading
        // before writing UI" — it is a lookup, and counting it would inflate the answer.
        if (b.name === 'Read' && !sawWrite) {
          const f = String(b.input?.file_path ?? '');
          const m = f.match(/references\/([a-z0-9-]+)\.md$/i);
          if (m && !refsRead.includes(m[1])) refsRead.push(m[1]);
        }
        if (/^(Write|Edit|NotebookEdit|MultiEdit)$/.test(b.name)) sawWrite = true;
      }
    }
  }

  return {
    transcript: texts.join('\n'),
    preCode: preTexts.join('\n'),
    toolUses,
    refsRead,
    usedSkill: toolUses.includes('Skill'),
  };
}

export const EXPERIMENTS = {
  skill: {
    name: 'skill',
    suite: 'benchmark',
    description: 'Headless Claude Code with the Skill tool available — ui-craft reachable.',
    run: (opts) => runClaude({ ...opts, allowSkill: true }),
  },
  'skill-mcp': {
    name: 'skill-mcp',
    suite: 'benchmark',
    description:
      'Skill plus the ui-craft MCP server — the gates, the router and the fold draw reachable. ' +
      'A separate arm rather than a change to `skill`, so the recorded fixtures keep meaning ' +
      'what they meant and skill → skill-mcp isolates what the tools add.',
    run: (opts) => runClaude({ ...opts, allowSkill: true, allowMcp: true }),
  },
  'no-skill': {
    name: 'no-skill',
    suite: 'no-skill',
    description: 'Same driver, Skill tool blocked — the control arm. Measures what the skill adds.',
    run: (opts) => runClaude({ ...opts, allowSkill: false }),
  },
  recorded: {
    name: 'recorded',
    suite: 'regression',
    description:
      'Scores a workspace + transcript captured earlier instead of spending an agent run. ' +
      'This is what lets the scorers themselves be tested in CI: a recorded build never drifts, ' +
      'so a check that changes verdict changed because the SCORER changed.',
    run: () => {
      throw new Error('the recorded experiment is driven by --record, not by spawning an agent');
    },
  },
};

export function resolveExperiments(names) {
  const out = [];
  for (const n of names) {
    const e = EXPERIMENTS[n];
    if (!e) throw new Error(`unknown experiment "${n}" — known: ${Object.keys(EXPERIMENTS).join(', ')}`);
    out.push(e);
  }
  return out;
}

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

const DRIVER = 'claude';

// Enough to build a real surface, nothing that reaches the network or the user's machine
// beyond the sandbox directory.
const BUILD_TOOLS = ['Write', 'Edit', 'Read', 'Glob', 'Grep', 'Bash', 'TodoWrite'];

/**
 * Drive the headless CLI in `workspace` and return everything it said.
 *
 * The transcript is the return value, not a side effect: half of what a build eval scores
 * (did the Craft Read appear, in the prescribed shape, before the code) exists only here.
 */
function runClaude({ prompt, workspace, allowSkill, model, timeoutMs }) {
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
    [...BUILD_TOOLS, ...(allowSkill ? ['Skill'] : [])].join(','),
  ];
  if (!allowSkill) args.push('--disallowedTools', 'Skill');
  if (model) args.push('--model', model);

  return new Promise((resolve) => {
    // stdin is closed, not inherited. Left open, the driver waits on it and warns
    // "no stdin data received in 3s" before proceeding — a stall on every single run.
    const child = spawn(DRIVER, args, { cwd: workspace, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });

    let raw = '';
    let err = '';
    const finish = (extra) => {
      const parsed = parseStream(raw);
      resolve({ ...parsed, raw, stderr: err + (extra ?? ''), ...(extra ? { timedOut: true } : {}) });
    };

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish('\n[harness] timed out');
    }, timeoutMs);

    child.stdout.on('data', (d) => (raw += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      err += `\n[harness] driver failed to start: ${e.message}`;
      finish();
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const out = parseStream(raw);
      resolve({ ...out, raw, stderr: err, code });
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
        if (/^(Write|Edit|NotebookEdit|MultiEdit)$/.test(b.name)) sawWrite = true;
      }
    }
  }

  return {
    transcript: texts.join('\n'),
    preCode: preTexts.join('\n'),
    toolUses,
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

/**
 * eval-build.test.mjs — tests for the build-eval harness.
 *
 * Runs against the RECORDED fixtures, so the whole suite costs no agent calls and is safe in
 * CI. The two recorded builds are frozen blind runs against v0.8.0: one that passed its
 * checklist and one that failed on the two findings which produced v0.8.1.
 *
 * That asymmetry is the point. A harness that only has passing fixtures cannot tell you it
 * still detects anything — the first test below would go green with every check stubbed to
 * `true`. Keeping a known-bad build is what makes the scorers falsifiable.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeContext, runScorer, wordCount, visibleText } from '../evals/build/_lib/context.mjs';
import { EXPERIMENTS, resolveExperiments, parseStream } from '../evals/build/_lib/experiments.mjs';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD_DIR = path.join(REPO_ROOT, 'evals', 'build');

async function scoreRecorded(id) {
  const dir = path.join(BUILD_DIR, id);
  const { default: scorer } = await import(path.join(dir, 'EVAL.mjs'));
  const transcript = await fs.readFile(path.join(dir, 'recorded', 'transcript.txt'), 'utf8');
  const ctx = await makeContext({ workspace: path.join(dir, 'recorded', 'workspace'), transcript });
  return runScorer(scorer, ctx);
}

const named = (result, name) => result.checks.find((c) => c.name.startsWith(name));

// ─── The findings that produced v0.8.1 ───────────────────────────────────────

test('landing fixture: the 32-word hero subtext is caught', async () => {
  const r = await scoreRecorded('craft-landing-001');
  const check = named(r, 'hero subtext');

  assert.ok(check, 'the subtext check must run');
  assert.equal(check.pass, false, 'a 32-word subtext must fail a ≤20 limit');
  assert.match(check.evidence, /32 words/, 'the evidence must state the count that decided it');
});

test('landing fixture: a transcript with the right decisions but no Craft Read line fails', async () => {
  const r = await scoreRecorded('craft-landing-001');

  assert.equal(named(r, 'Craft Read line emitted').pass, false);
  // The recorded transcript does declare variance ~7 and a signature detail in prose, which
  // is exactly why a file-only scorer would have called this build clean.
  const raw = await fs.readFile(path.join(BUILD_DIR, 'craft-landing-001', 'recorded', 'transcript.txt'), 'utf8');
  assert.match(raw, /DESIGN_VARIANCE ~7/);
  assert.match(raw, /Signature detail/i);
});

test('dashboard fixture: the missing table overflow and sticky header are caught', async () => {
  const r = await scoreRecorded('craft-dashboard-001');

  assert.equal(named(r, 'table is wrapped in overflow-x').pass, false);
  assert.equal(named(r, 'table header is sticky').pass, false);
  assert.match(named(r, 'table is wrapped in overflow-x').evidence, /overflow-hidden|no overflow/);
});

// ─── What the same fixtures prove still works ────────────────────────────────

test('dashboard fixture: a well-formed Craft Read passes every transcript check', async () => {
  const r = await scoreRecorded('craft-dashboard-001');

  for (const name of ['Craft Read line emitted', 'Craft Read names product', 'Craft Read declares', 'variance is a product', 'Craft Read names a signature']) {
    assert.equal(named(r, name).pass, true, `${name} should pass on the dashboard fixture`);
  }
});

test('dashboard fixture: only the table checks fail', async () => {
  const r = await scoreRecorded('craft-dashboard-001');
  const failures = r.checks.filter((c) => !c.pass).map((c) => c.name);

  assert.deepEqual(
    failures.sort(),
    ['table header is sticky', 'table is wrapped in overflow-x'],
    `unexpected failures: ${failures.join(', ')}`
  );
});

test('landing fixture: every non-Craft-Read, non-subtext check passes', async () => {
  const r = await scoreRecorded('craft-landing-001');
  const unexpected = r.checks
    .filter((c) => !c.pass)
    .map((c) => c.name)
    .filter((n) => !/Craft Read|variance|hero subtext/.test(n));

  assert.deepEqual(unexpected, [], `unexpected failures: ${unexpected.join(', ')}`);
});

// ─── Scoring mechanics ───────────────────────────────────────────────────────

test('workspace score is the worst file, not the mean', async () => {
  const dir = path.join(BUILD_DIR, 'craft-landing-001', 'recorded', 'workspace');
  const ctx = await makeContext({ workspace: dir });
  const s = await ctx.score();

  assert.ok(s.files.length > 1, 'fixture must have several files for this to mean anything');
  assert.ok(s.min <= s.mean, 'min cannot exceed mean');
  assert.equal(s.min, s.worst.score, 'worst must be the file that set the minimum');
  assert.ok(s.worst.file, 'the worst file must be named — an unnamed failure is not actionable');
});

test('a check with no evidence is rejected', async () => {
  const ctx = await makeContext({ workspace: path.join(BUILD_DIR, 'craft-landing-001', 'recorded', 'workspace') });

  assert.throws(() => ctx.check('nameless', true, ''), /no evidence/);
});

test('a scorer that throws fails the eval instead of crashing the run', async () => {
  const ctx = await makeContext({ workspace: path.join(BUILD_DIR, 'craft-landing-001', 'recorded', 'workspace') });
  const r = await runScorer(() => {
    throw new Error('boom');
  }, ctx);

  assert.equal(r.pass, false);
  assert.match(r.checks.at(-1).evidence, /boom/);
  assert.equal(r.checks.at(-1).fatal, true);
});

test('word count measures prose, not JSX', () => {
  assert.equal(wordCount('<span className="x">two words</span>'), 2);
  assert.equal(wordCount('{count} items left'), 2);
  assert.equal(visibleText('<b>a</b> <i>b</i>'), 'a b');
});

// ─── Experiments ─────────────────────────────────────────────────────────────

test('experiments: skill and no-skill both exist and differ', () => {
  assert.ok(EXPERIMENTS.skill);
  assert.ok(EXPERIMENTS['no-skill']);
  assert.notEqual(EXPERIMENTS.skill.description, EXPERIMENTS['no-skill'].description);
  assert.equal(EXPERIMENTS['no-skill'].suite, 'no-skill');
});

test('experiments: an unknown name is an error, not a silent skip', () => {
  assert.throws(() => resolveExperiments(['skill', 'nope']), /unknown experiment "nope"/);
});

test('experiments: the recorded arm refuses to spawn an agent', () => {
  assert.throws(() => EXPERIMENTS.recorded.run({}), /driven by --record/);
});

// ─── Stream parsing ──────────────────────────────────────────────────────────
//
// Synthetic NDJSON, so the parser's failure modes are pinned without an agent run. Both
// cases below were real bugs found by running it, and each cost a live build to discover.

const ndjson = (...msgs) => msgs.map((m) => JSON.stringify(m)).join('\n');
const assistant = (...content) => ({ type: 'assistant', message: { role: 'assistant', content } });
const userMsg = (...content) => ({ type: 'user', message: { role: 'user', content } });

test('parseStream: a Skill tool result never becomes transcript', () => {
  // The bug: the skill body arrived as a tool result, so "Craft Read emitted" passed by
  // matching SKILL.md's own instruction to emit one. The check reported the gate working
  // while measuring nothing — worse than failing.
  const raw = ndjson(
    assistant({ type: 'tool_use', name: 'Skill', input: { skill: 'ui-craft' } }),
    userMsg({ type: 'text', text: 'output the **Craft Read** from craft-intent.md before writing code' }),
    assistant({ type: 'text', text: 'Building the shell now.' })
  );
  const out = parseStream(raw);

  assert.ok(!out.transcript.includes('craft-intent.md'), 'skill body must not enter the transcript');
  assert.match(out.transcript, /Building the shell now/);
  assert.equal(out.usedSkill, true, 'the Skill call itself is still recorded');
});

test('parseStream: preCode stops at the first Write', () => {
  const raw = ndjson(
    assistant({ type: 'text', text: '**Craft Read:** ops dashboard, product language, variance 4, signature bet: x.' }),
    assistant({ type: 'tool_use', name: 'Write', input: {} }),
    assistant({ type: 'text', text: 'Done — here is a summary of the decisions.' })
  );
  const out = parseStream(raw);

  assert.match(out.preCode, /Craft Read/);
  assert.ok(!out.preCode.includes('summary of the decisions'), 'post-write narration is not preCode');
  assert.match(out.transcript, /summary of the decisions/, 'but it is still in the full transcript');
});

test('parseStream: a Craft Read produced only AFTER the code does not count', () => {
  const raw = ndjson(
    assistant({ type: 'tool_use', name: 'Write', input: {} }),
    assistant({ type: 'text', text: '**Craft Read:** ops dashboard, product language, variance 4, signature bet: x.' })
  );
  const out = parseStream(raw);

  assert.equal(out.preCode, '', 'nothing was said before the first write');
  assert.match(out.transcript, /Craft Read/);
});

test('parseStream: a truncated stream still yields what arrived', () => {
  const raw = `${ndjson(assistant({ type: 'text', text: 'partial work' }))}\n{"type":"assist`;
  const out = parseStream(raw);

  assert.match(out.transcript, /partial work/);
});

test('parseStream: an empty stream is empty, not a crash', () => {
  const out = parseStream('');
  assert.equal(out.transcript, '');
  assert.equal(out.usedSkill, false);
  assert.deepEqual(out.toolUses, []);
});

test('scorers reject a Craft Read that is only a mid-sentence reference', async () => {
  // Same discriminator as the parser fix, at the scorer level: an emitted read opens a
  // line, a reference to one sits mid-sentence.
  const dir = path.join(BUILD_DIR, 'craft-dashboard-001');
  const { default: scorer } = await import(path.join(dir, 'EVAL.mjs'));
  const ctx = await makeContext({
    workspace: path.join(dir, 'recorded', 'workspace'),
    transcript: 'I will output the **Craft Read** from craft-intent.md before writing any code.',
  });
  const r = await runScorer(scorer, ctx);

  assert.equal(named(r, 'Craft Read line emitted').pass, false);
});

test('sticky check ignores a comment that merely says "sticky"', async () => {
  const { promises: fsp } = await import('node:fs');
  const os = await import('node:os');
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'uicraft-sticky-'));
  await fsp.writeFile(
    path.join(tmp, 'QueueTable.jsx'),
    `export default function QueueTable() {
      // A sticky header would help here one day.
      return <div className="overflow-x-auto"><table><thead><tr className="bg-white"><th>x</th></tr></thead></table></div>;
    }`
  );
  const { default: scorer } = await import(path.join(BUILD_DIR, 'craft-dashboard-001', 'EVAL.mjs'));
  const r = await runScorer(scorer, await makeContext({ workspace: tmp }));
  const check = named(r, 'table header is sticky');

  assert.equal(check.pass, false, 'a comment is not a style');
  assert.match(check.evidence, /never in a className/);
});

// ─── Corpus integrity ────────────────────────────────────────────────────────

test('every build eval has a prompt, a scorer and a recorded fixture', async () => {
  const dirs = (await fs.readdir(BUILD_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name);

  assert.ok(dirs.length > 0, 'there must be at least one build eval');
  for (const id of dirs) {
    for (const rel of ['PROMPT.md', 'EVAL.mjs', 'recorded/workspace', 'recorded/transcript.txt', 'recorded/README.md']) {
      await fs.access(path.join(BUILD_DIR, id, rel));
    }
    const raw = await fs.readFile(path.join(BUILD_DIR, id, 'PROMPT.md'), 'utf8');
    assert.match(raw, /^---\n[\s\S]*?\nsuite:\s*\w+/, `${id}: PROMPT.md needs frontmatter with a suite`);
    assert.match(raw, /\n---\n[\s\S]*\S/, `${id}: PROMPT.md needs a task body after the frontmatter`);
  }
});

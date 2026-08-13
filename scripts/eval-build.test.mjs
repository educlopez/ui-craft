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
import { promises as fs, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeContext, runScorer, wordCount, visibleText } from '../evals/build/_lib/context.mjs';
import { EXPERIMENTS, MCP_TOOLS, resolveExperiments, parseStream } from '../evals/build/_lib/experiments.mjs';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD_DIR = path.join(REPO_ROOT, 'evals', 'build');

/**
 * Score a recorded fixture.
 *
 * A transcript is either a raw `.ndjson` stream or a plain `.txt`. The stream form is
 * preferred and folded exactly as a live run folds it, because only it carries tool order —
 * without that, "did the Craft Read come before the code" degrades to "does it appear at
 * all", which is a different and weaker question.
 */
async function scoreRecorded(id) {
  const dir = path.join(BUILD_DIR, id);
  const rec = path.join(dir, 'recorded');
  const { default: scorer } = await import(path.join(dir, 'EVAL.mjs'));

  let transcript = '';
  let preCode = null;
  let toolUses = [];
  let refsRead = [];
  const ndjson = path.join(rec, 'transcript.ndjson');
  const txt = path.join(rec, 'transcript.txt');
  if (await fs.access(ndjson).then(() => true, () => false)) {
    ({ transcript, preCode, toolUses, refsRead } = parseStream(await fs.readFile(ndjson, 'utf8')));
  } else {
    transcript = await fs.readFile(txt, 'utf8');
  }

  const ctx = await makeContext({
    workspace: path.join(rec, 'workspace'),
    transcript,
    preCode,
    toolUses,
    refsRead,
    seedDir: path.join(dir, 'local'),
  });
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

  // This fixture ships a .txt transcript, which carries no tool-use events, so "before the
  // first write" is not answerable from it. It reports UNMEASURABLE rather than a verdict —
  // and the old ✗ here was as unearned as the ✓ the dashboard fixture used to get.
  assert.equal(named(r, 'Craft Read line emitted').unmeasurable, true);

  // Detection coverage is what this test was really for, so ask it again with ordering
  // supplied: no Craft Read in preCode must still be a real failure.
  const { default: scorer } = await import(path.join(BUILD_DIR, 'craft-landing-001', 'EVAL.mjs'));
  const ordered = await makeContext({
    workspace: path.join(BUILD_DIR, 'craft-landing-001', 'recorded', 'workspace'),
    transcript: 'DESIGN_VARIANCE ~7 and a Signature detail, but no read line',
    preCode: 'DESIGN_VARIANCE ~7 and a Signature detail, but no read line',
  });
  const r2 = await runScorer(scorer, ordered);
  assert.equal(named(r2, 'Craft Read line emitted').pass, false, 'a real absence must still fail');

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

  // "line emitted" is an ordering question and this fixture ships a .txt transcript, so it is
  // unmeasurable rather than passing — that ✓ was the false pass. The CONTENT checks are
  // still answerable from an unordered transcript and must still pass.
  assert.equal(named(r, 'Craft Read line emitted').unmeasurable, true);
  assert.equal(named(r, 'Craft Read line emitted').pass, null, 'never true — the JSON is read by other things');

  for (const name of ['Craft Read names product', 'Craft Read declares', 'variance is a product', 'Craft Read names a signature']) {
    assert.equal(named(r, name).pass, true, `${name} should pass on the dashboard fixture`);
  }
});

test('dashboard fixture: only the table checks fail', async () => {
  const r = await scoreRecorded('craft-dashboard-001');
  // pass === false, not falsy: an unmeasurable check carries null and is not a failure.
  const failures = r.checks.filter((c) => c.pass === false).map((c) => c.name);

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
  // preCode is supplied deliberately: without it the check reports UNMEASURABLE and the
  // discriminator this test exists for is never exercised.
  const said = 'I will output the **Craft Read** from craft-intent.md before writing any code.';
  const ctx = await makeContext({
    workspace: path.join(dir, 'recorded', 'workspace'),
    transcript: said,
    preCode: said,
  });
  const r = await runScorer(scorer, ctx);

  assert.equal(named(r, 'Craft Read line emitted').pass, false);
  assert.equal(named(r, 'Craft Read line emitted').unmeasurable, undefined);
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

test('classes() reads className however React writes it', async () => {
  const ctx = await makeContext({ workspace: path.join(BUILD_DIR, 'craft-landing-001', 'recorded', 'workspace') });

  assert.equal(ctx.classes('<nav className="w-60 bg-nav">', /nav/), 'w-60 bg-nav');
  assert.equal(ctx.classes('<nav className={`w-60 ${x} bg-nav`}>', /nav/), 'w-60 bg-nav');
  // The array-join form is what real components use, and the regex that only understood
  // quoted strings reported "could not read the classes" on a perfectly fine sidebar —
  // a false failure, which accuses the build of something it did not do.
  const arrayJoin = `<nav
      aria-label="Main navigation"
      className={[
        'fixed inset-y-0 flex w-60 flex-col bg-surface-2',
        open ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
    >`;
  const cls = ctx.classes(arrayJoin, /nav/);
  assert.match(cls, /bg-surface-2/, `expected the tint class, got: ${cls}`);
  assert.match(cls, /w-60/);
});

test('a tinted sidebar written as an array-join is not reported as full dark', async () => {
  const { promises: fsp } = await import('node:fs');
  const os = await import('node:os');
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'uicraft-sidebar-'));
  await fsp.writeFile(
    path.join(tmp, 'Sidebar.tsx'),
    `export default function Sidebar({ open }) {
      return (<nav className={['flex w-60 flex-col bg-surface-2', open ? 'x' : 'y'].join(' ')}>
        <div className="bg-black/60" />
      </nav>);
    }`
  );
  const { default: scorer } = await import(path.join(BUILD_DIR, 'craft-dashboard-001', 'EVAL.mjs'));
  const r = await runScorer(scorer, await makeContext({ workspace: tmp }));
  const check = named(r, 'sidebar is tinted');

  assert.equal(check.pass, true, `should pass: ${check.evidence}`);
  assert.match(check.evidence, /bg-surface-2/);
});

// ─── Corpus integrity ────────────────────────────────────────────────────────

test('every build eval has a prompt, a scorer and a recorded fixture', async () => {
  const dirs = (await fs.readdir(BUILD_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name);

  assert.ok(dirs.length > 0, 'there must be at least one build eval');
  for (const id of dirs) {
    for (const rel of ['PROMPT.md', 'EVAL.mjs', 'recorded/workspace', 'recorded/README.md']) {
      await fs.access(path.join(BUILD_DIR, id, rel));
    }
    const hasTranscript = await Promise.any(
      ['transcript.ndjson', 'transcript.txt'].map((f) => fs.access(path.join(BUILD_DIR, id, 'recorded', f)))
    ).then(() => true, () => false);
    assert.ok(hasTranscript, `${id}: recorded/ needs a transcript.ndjson or transcript.txt`);
    const raw = await fs.readFile(path.join(BUILD_DIR, id, 'PROMPT.md'), 'utf8');
    assert.match(raw, /^---\n[\s\S]*?\nsuite:\s*\w+/, `${id}: PROMPT.md needs frontmatter with a suite`);
    assert.match(raw, /\n---\n[\s\S]*\S/, `${id}: PROMPT.md needs a task body after the frontmatter`);
  }
});

// ── The MCP arm ─────────────────────────────────────────────────────────────
//
// Every recorded build was captured with no ui-craft MCP tool in the driver's allowlist,
// so the gates, the router and the fold draw had never once run inside an eval. The harness
// that exists to test "not whether a rule is written, but whether it was followed" could not
// reach half of what the product ships. These pin the correction.

test('the MCP arm exposes exactly the tools the server registers', () => {
  // The failure this prevents is silent: a tool added to the server but not here is simply
  // unreachable in evals, and nothing reports it. That is how fold_candidates went unexercised
  // for its entire life.
  const server = readFileSync(new URL('../mcp/src/server.mjs', import.meta.url), 'utf8');
  const registered = [...server.matchAll(/registerTool\(\s*'([a-z_]+)'/g)].map((m) => m[1]);
  assert.ok(registered.length >= 7, `expected the server to register tools, found ${registered.length}`);

  const exposed = MCP_TOOLS.map((t) => t.replace('mcp__ui-craft__', ''));
  assert.deepEqual(
    [...exposed].sort(),
    [...registered].sort(),
    'the eval allowlist and the MCP server disagree about which tools exist'
  );
});

test('only the MCP arm turns the tools on', () => {
  assert.equal(EXPERIMENTS['skill-mcp'].suite, 'benchmark');
  // skill and no-skill must stay as they were, or the recorded fixtures stop being a control.
  assert.ok(EXPERIMENTS.skill, 'the plain skill arm still exists');
  assert.ok(EXPERIMENTS['no-skill'], 'the control arm still exists');
});

// ── Unmeasurable is not a pass ───────────────────────────────────────────────
//
// A `.txt` recorded transcript carries no tool-use events, so there is no first write to
// order against and `preCode` falls back to the whole transcript. That turned "before the
// first write" into "appears anywhere", and the only fixture that ever passed the Craft Read
// check was a .txt one — its ✓ meant "somewhere in the transcript". Same shape as every
// other instrument bug here: cannot check, rendered as checked and passed.

test('checkOrdered reports UNMEASURABLE when the transcript cannot order events', async () => {
  const ctx = await makeContext({ workspace: process.cwd(), transcript: 'Craft Read: a line that exists somewhere' });
  assert.equal(ctx.orderingKnown, false, 'no preCode was supplied, so ordering is not knowable');

  ctx.checkOrdered('ordered thing', true, 'would have passed');
  const rec = ctx.checks.at(-1);
  assert.equal(rec.unmeasurable, true);
  assert.match(rec.evidence, /UNMEASURABLE/);
  assert.match(rec.evidence, /Not a pass/);
});

test('checkOrdered behaves normally once ordering is known', async () => {
  const ctx = await makeContext({ workspace: process.cwd(), transcript: 'full', preCode: 'before the write' });
  assert.equal(ctx.orderingKnown, true);
  ctx.checkOrdered('ordered thing', false, 'genuinely absent');
  const rec = ctx.checks.at(-1);
  assert.equal(rec.unmeasurable, undefined, 'a knowable question must produce a real verdict');
  assert.equal(rec.pass, false);
});

test('an unmeasurable check inflates neither the numerator nor the denominator', async () => {
  const ctx = await makeContext({ workspace: process.cwd(), transcript: 't' });
  ctx.check('real pass', true, 'evidence');
  ctx.check('real fail', false, 'evidence');
  ctx.checkOrdered('cannot tell', true, 'evidence');
  const result = await runScorer(() => {}, ctx);
  assert.equal(result.total, 2, 'the unmeasurable check must leave the denominator');
  assert.equal(result.failed, 1);
  assert.equal(result.unmeasurable, 1, 'and must be reported on its own');
});

test('every scorer routes its Craft Read check through checkOrdered', async () => {
  // The migration is the point. A scorer that asks an ordering question with plain check()
  // silently regains the false pass, and no other test would notice.
  const dirs = await fs.readdir(new URL('../evals/build/', import.meta.url));
  let asked = 0;
  for (const d of dirs) {
    let src;
    try {
      src = await fs.readFile(new URL(`../evals/build/${d}/EVAL.mjs`, import.meta.url), 'utf8');
    } catch {
      continue;
    }
    if (!src.includes("'Craft Read line emitted'")) continue;
    asked++;
    assert.match(
      src,
      /ctx\.checkOrdered\(\s*'Craft Read line emitted'/,
      `${d}: the Craft Read check must use checkOrdered — it asks "before the first write"`
    );
  }
  assert.ok(asked >= 5, `expected several scorers to ask this; found ${asked}`);
});

/**
 * route-task.test.mjs
 * Tests for the route_task tool.
 *
 * The cases that matter most are the vocabulary-mismatch ones: a prompt that shares no
 * word with the filename it should reach. Those are the reason the tool exists, so they
 * are asserted by name rather than left to a generic "returns something" check.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeTask, tokenize, stem, editDistance, toConcepts, isRepairIntent } from './route-task.mjs';
import { CORPUS, SYNONYMS, STOPWORDS, REPAIR_MARKERS, OUT_OF_SCOPE } from '../route-data.mjs';

const names = (result, kind = 'references') => result.results[kind].map((r) => r.name);
const allNames = (result) => [
  ...names(result, 'commands'),
  ...names(result, 'references'),
  ...names(result, 'mcp_tools'),
];

// ─── The vocabulary mismatch this tool was built for ─────────────────────────

test('route_task: "analytics" reaches the dashboard recipe even though the filename never says analytics', () => {
  const result = routeTask({ prompt: 'analytics view with KPIs' });

  assert.ok(!result.error, `should not error: ${result.error}`);
  assert.ok(
    names(result).includes('recipe-dashboard'),
    `expected recipe-dashboard in references, got: ${names(result).join(', ')}`
  );
  // And the file itself contains no such word — otherwise this test proves nothing.
  const entry = CORPUS.find((e) => e.id === 'ref-recipe-dashboard');
  assert.ok(
    !entry.name.includes('analytic') && !/analytic/i.test(entry.summary),
    'the point of this case is that name and summary do NOT contain the queried word'
  );
});

test('route_task: task filler does not become a concept', () => {
  const concepts = toConcepts('build me a pricing page please').map((c) => c.token);

  for (const filler of ['build', 'me', 'a', 'please']) {
    assert.ok(!concepts.includes(filler), `"${filler}" should have been dropped, got: ${concepts.join(', ')}`);
  }
  assert.ok(concepts.length > 0, 'something must survive — otherwise ranking has no input');
});

test('route_task: "pricing" reaches the landing recipe through the constituents index', () => {
  const result = routeTask({ prompt: 'pricing section' });
  const found = allNames(result);

  assert.ok(
    found.includes('recipe-landing'),
    `pricing lives inside the landing recipe; got: ${found.join(', ')}`
  );
});

test('route_task: typo still lands ("dashbord")', () => {
  const result = routeTask({ prompt: 'dashbord layout' });
  const found = allNames(result);

  assert.ok(found.length > 0, 'a one-character typo must not empty the result set');
  assert.ok(
    found.some((n) => n.includes('dashboard')),
    `expected a dashboard entry via fuzzy match, got: ${found.join(', ')}`
  );
});

// ─── Recommendation, not a list ───────────────────────────────────────────────

test('route_task: returns a first_move, and it is a command when one applies', () => {
  const result = routeTask({ prompt: 'animate this drawer' });

  assert.ok(result.first_move, 'first_move must be set');
  assert.equal(result.first_move, '/animate');
});

test('route_task: first_move falls back to a reference-attached command', () => {
  const result = routeTask({ prompt: 'oklch accent palette for dark mode' });

  assert.ok(result.first_move, `expected a first move, got: ${result.first_move}`);
  assert.ok(allNames(result).includes('color'), 'color entry should be in play');
});

test('route_task: instruction always names Discovery and the pointer boundary', () => {
  const result = routeTask({ prompt: 'build a signup form' });

  assert.match(result.instruction, /Discovery/);
  assert.match(result.instruction, /pointers only/i);
});

test('route_task: a concrete move beats a placeholder one', () => {
  const result = routeTask({ prompt: 'landing with pricing and testimonials' });

  assert.equal(result.first_move, '/craft landing', 'the recipe already resolved the surface');
  assert.ok(!result.first_move.includes('<'), 'a placeholder is a template, not a move');
});

test('route_task: an mcp tool never wins the first move over a command or reference', () => {
  // check_fold and recipe-landing tie on "landing"; the tool must not take the move.
  const result = routeTask({ prompt: 'landing' });

  assert.ok(!/^(check_fold|fold_candidates|score_ui)$/.test(result.first_move ?? ''),
    `an inspection tool is not a first move, got: ${result.first_move}`);
});

// ─── Repair intent ───────────────────────────────────────────────────────────

test('route_task: repair intent is detected', () => {
  assert.ok(isRepairIntent('the signup form validates wrong'));
  assert.ok(isRepairIntent('this table is slow'));
  assert.ok(isRepairIntent('the drawer animation jumps'));
  assert.ok(!isRepairIntent('build me a billing dashboard'));
});

test('route_task: repair never answers with a build command', () => {
  const result = routeTask({ prompt: 'the signup form validates wrong' });

  assert.equal(result.intent, 'repair');
  assert.ok(
    !/^\/(craft|sddesign|shape)\b/.test(result.first_move ?? ''),
    `a broken form is not fixed by building a new surface, got: ${result.first_move}`
  );
  assert.match(result.instruction, /already exists and is wrong/);
  assert.ok(names(result).includes('forms'), 'it should still point at the right reference');
});

test('route_task: repair prefers the pass over a reference build-time default', () => {
  // motion.md carries "/animate"; a slow 3000-row table is a table problem, not a motion one.
  const result = routeTask({ prompt: 'this 3000 row table is slow' });

  assert.equal(result.intent, 'repair');
  assert.equal(result.first_move, '/audit');
});

test('route_task: a build prompt keeps its build move', () => {
  const result = routeTask({ prompt: 'a billing dashboard' });

  assert.equal(result.intent, 'build');
  assert.equal(result.first_move, '/craft dashboard');
});

// ─── Honest misses ───────────────────────────────────────────────────────────

test('route_task: unmatched prompt says so instead of inventing a route', () => {
  const result = routeTask({ prompt: 'kubernetes ingress controller certificate rotation' });

  assert.equal(result.results.commands.length, 0);
  assert.equal(result.results.references.length, 0);
  assert.equal(result.first_move, '/start');
  assert.match(result.instruction, /not a fallback/);
});

test('route_task: prompt of pure stopwords routes to /start', () => {
  const result = routeTask({ prompt: 'please make me something nice' });

  assert.equal(result.first_move, '/start');
  assert.equal(result.concepts.length, 0);
});

test('route_task: missing prompt errors with guidance', () => {
  const result = routeTask({});

  assert.ok(result.error);
  assert.match(result.error, /prompt/);
  assert.equal(result.first_move, null);
});

// ─── Ranking behaviour ───────────────────────────────────────────────────────

test('route_task: exact name beats an incidental summary word', () => {
  const result = routeTask({ prompt: 'typography' });
  const refs = result.results.references;

  assert.equal(refs[0].name, 'typography', `expected typography first, got: ${refs.map((r) => r.name).join(', ')}`);
});

test('route_task: covering a second concept can only help, never dilute', () => {
  // /audit matches both concepts (name 100 + keyword 60); /critique matches one at 100.
  // Averaging the signals dropped /audit to 80 and handed a keyboard-a11y prompt to
  // /critique. Strength is the best claim; breadth is paid for separately.
  const result = routeTask({ prompt: 'review keyboard accessibility' });
  const cmds = result.results.commands;

  assert.equal(cmds[0].name, 'audit', `expected audit first, got: ${cmds.map((c) => c.name).join(', ')}`);
  assert.equal(result.first_move, '/audit');
});

test('route_task: a rambling prompt is not punished — coverage adds, it never scales', () => {
  const tight = routeTask({ prompt: 'dashboard' });
  const rambling = routeTask({
    prompt: 'dashboard for our internal team, probably with some filters and whatnot, kubernetes adjacent',
  });
  const tightTop = tight.results.references[0]?.score ?? 0;
  const ramblingTop = rambling.results.references[0]?.score ?? 0;

  assert.ok(ramblingTop > 0, 'the rambling prompt must still match');
  assert.ok(
    ramblingTop >= tightTop * 0.5,
    `rambling (${ramblingTop}) should stay within half of tight (${tightTop}) — the mean protects it`
  );
});

test('route_task: repeated synonyms of one idea collapse to a single concept', () => {
  const concepts = toConcepts('dashboard analytics KPIs metrics');

  assert.equal(concepts.length, 1, `expected one collapsed concept, got: ${concepts.map((c) => c.token).join(', ')}`);
});

test('route_task: results are deterministic across calls', () => {
  const a = routeTask({ prompt: 'landing page hero with social proof' });
  const b = routeTask({ prompt: 'landing page hero with social proof' });

  assert.deepEqual(a, b);
});

test('route_task: limit is clamped to [1,12]', () => {
  assert.ok(routeTask({ prompt: 'color', limit: 0 }).results.references.length <= 12);
  assert.ok(routeTask({ prompt: 'color', limit: 999 }).results.references.length <= 12);
});

// ─── Corpus integrity ────────────────────────────────────────────────────────

test('route-data: every corpus entry is well formed', () => {
  for (const entry of CORPUS) {
    assert.ok(entry.id, 'entry needs an id');
    assert.ok(['command', 'reference', 'mcp_tool'].includes(entry.kind), `bad kind on ${entry.id}`);
    assert.ok(entry.name, `${entry.id} needs a name`);
    assert.ok(entry.path, `${entry.id} needs a path`);
    assert.ok(entry.summary && entry.summary.length > 20, `${entry.id} needs a real summary`);
    assert.ok(Array.isArray(entry.keywords), `${entry.id}.keywords must be an array`);
    assert.ok(Array.isArray(entry.contains), `${entry.id}.contains must be an array`);
  }
});

test('route-data: corpus ids are unique', () => {
  const ids = CORPUS.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate id in CORPUS');
});

test('route-data: every keyword resolves to a real concept or is a literal name', () => {
  const conceptIds = new Set(Object.keys(SYNONYMS));
  const entryNames = new Set(CORPUS.map((e) => e.name));

  for (const entry of CORPUS) {
    for (const kw of entry.keywords) {
      const known = conceptIds.has(kw) || entryNames.has(kw) || kw.length > 2;
      assert.ok(known, `${entry.id}: keyword "${kw}" is too short to ever match`);
    }
  }
});

test('route-data: no synonym alias is also a stopword', () => {
  // An alias that is also a stopword can never fire — the token is dropped before
  // expansion, so the alias is dead weight that reads as coverage.
  const offenders = [];
  for (const [concept, aliases] of Object.entries(SYNONYMS)) {
    for (const alias of aliases) {
      if (STOPWORDS.has(alias)) offenders.push(`${concept} → ${alias}`);
    }
  }
  assert.deepEqual(offenders, [], `these aliases are shadowed by stopwords: ${offenders.join(', ')}`);
});

test('route-data: every mcp_tool entry names a tool the server actually registers', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const serverPath = fileURLToPath(new URL('../server.mjs', import.meta.url));
  const server = readFileSync(serverPath, 'utf8');

  for (const entry of CORPUS.filter((e) => e.kind === 'mcp_tool')) {
    assert.ok(
      server.includes(`'${entry.name}'`),
      `route-data lists mcp tool "${entry.name}" but server.mjs does not register it`
    );
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

test('tokenize: drops stopwords, punctuation and bare numbers', () => {
  assert.deepEqual(tokenize('Build me a Dashboard, with 3 charts!'), ['dashboard', 'charts']);
});

test('tokenize: strips accents so a diacritic still matches the index', () => {
  assert.ok(tokenize('café menu').includes('cafe'));
});

test('stem: folds plurals', () => {
  assert.equal(stem('charts'), stem('chart'));
  assert.equal(stem('tables'), stem('table'));
});

test('stem: leaves short words alone', () => {
  assert.equal(stem('css'), 'css');
  assert.equal(stem('has'), 'has');
});

test('stem: does not collide "states" with "stats"', () => {
  // This collision routed every dashboard prompt to the unhappy-path command, because
  // "stats" (a dashboard alias) and "states" (an unhappy-path keyword) shared a stem.
  assert.notEqual(stem('states'), stem('stats'));
});

test('route-data: words that are both an alias and a repair marker work as both', () => {
  // Overlap here is correct, not a conflict: "slow" names the performance concept AND
  // says something is wrong. The two mechanisms read different inputs — ranking reads
  // concepts, the intent gate reads raw tokens — so an overlapping word contributes to
  // both without either overriding the other. This asserts the behaviour rather than
  // forbidding the overlap.
  const aliases = new Set(Object.values(SYNONYMS).flat());
  const overlap = REPAIR_MARKERS.filter((m) => aliases.has(m));
  assert.ok(overlap.length > 0, 'expected some words to carry both signals');

  const result = routeTask({ prompt: 'the table is slow' });
  assert.equal(result.intent, 'repair', 'the marker fired');
  assert.ok(result.results.references.length > 0, 'and the alias still ranked something');
});

test('editDistance: bails out past max', () => {
  assert.equal(editDistance('dashbord', 'dashboard'), 1);
  assert.ok(editDistance('kubernetes', 'dashboard') > 2);
});

// ── Out-of-scope surface classes ────────────────────────────────────────────
//
// The failure these exist for is confident, not silent: "react native mobile screen"
// routed to responsive.md and accessibility.md — web guidance handed back for a native
// brief, with nothing saying so.

test('out of scope: a native brief is named as such, and still routed', () => {
  const r = routeTask({ prompt: 'react native mobile screen' });
  assert.deepEqual(
    r.out_of_scope.map((o) => o.id),
    ['native-mobile']
  );
  assert.match(r.instruction, /Apple HIG or Material/);
  // Additive, not a refusal: the surrounding web work still gets its references.
  assert.ok(r.results.references.length > 0, 'routing must still run alongside the verdict');
});

test('out of scope: classes that used to return nothing now return the pointer', () => {
  for (const [prompt, id] of [
    ['build an html email template', 'html-email'],
    ['code editor with syntax highlighting', 'code-editor'],
    ['live cursors and presence indicator', 'realtime-collab'],
  ]) {
    const r = routeTask({ prompt });
    assert.deepEqual(
      r.out_of_scope.map((o) => o.id),
      [id],
      `${prompt} should report ${id}`
    );
    assert.ok(r.out_of_scope[0].use.length > 0, 'a verdict without a pointer is just a refusal');
  }
});

test('out of scope: ordinary vocabulary does not trigger it', () => {
  // These are the false positives that would make the verdict noise. "mobile" is ordinary
  // responsive vocabulary, and a landing page for a native app is squarely our work — the
  // native screens are out of scope, the page selling them is not.
  for (const prompt of [
    'responsive mobile layout for the pricing table',
    'landing page for our iOS app',
    'analytics dashboard with KPIs',
    'mobile navigation drawer',
    'email capture form on the landing page',
  ]) {
    const r = routeTask({ prompt });
    assert.equal(r.out_of_scope, undefined, `${prompt} must not be flagged out of scope`);
  }
});

test('out of scope: every class is reachable by at least one trigger', () => {
  // A class nobody can reach is a class that does not exist. Without this, a typo in a
  // trigger list silently removes a verdict and every test above still passes.
  for (const cls of OUT_OF_SCOPE) {
    const hits = cls.triggers.filter(
      (t) => (routeTask({ prompt: `${t} work` }).out_of_scope ?? []).some((o) => o.id === cls.id)
    );
    assert.ok(hits.length === cls.triggers.length, `${cls.id}: unreachable triggers ${cls.triggers.filter((t) => !hits.includes(t))}`);
  }
});

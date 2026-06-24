/**
 * score.test.mjs
 * node:test suite for score.mjs and a11y-static.mjs
 * Zero external deps. Run: node --test evals/quality/
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scoreUI, _buildResult, WEIGHTS, GRADE_BANDS, EVAL_VERSION } from './score.mjs';
import { scanA11y } from './a11y-static.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dir, 'fixtures');
// Root of the repository (3 levels up from evals/quality/)
const REPO_ROOT = join(__dir, '..', '..');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fixturePath(rel) {
  return join(FIXTURES, rel);
}

// ─── 1. Formula unit tests ────────────────────────────────────────────────────

describe('formula unit tests (_buildResult)', () => {
  test('zero findings → score 100, grade A', () => {
    const r = _buildResult([], [], [], EVAL_VERSION);
    assert.equal(r.overall.score, 100);
    assert.equal(r.overall.grade, 'A');
  });

  test('1 critical anti-slop → score 92, grade A', () => {
    const r = _buildResult(
      [{ severity: 'critical', rule: 'transition-all', description: 'transition: all' }],
      [], [], EVAL_VERSION
    );
    assert.equal(r.overall.score, 100 - WEIGHTS.anti_slop.critical);
    assert.equal(r.overall.score, 92);
    assert.equal(r.overall.grade, 'A');
  });

  test('1 major anti-slop → score 96', () => {
    const r = _buildResult(
      [{ severity: 'major', rule: 'generic-cta', description: 'generic CTA' }],
      [], [], EVAL_VERSION
    );
    assert.equal(r.overall.score, 96);
  });

  test('1 warn anti-slop → score 99', () => {
    const r = _buildResult(
      [{ severity: 'warn', rule: 'inline-any-style', description: 'long inline style' }],
      [], [], EVAL_VERSION
    );
    assert.equal(r.overall.score, 99);
  });

  test('2 critical a11y → score 84, grade B', () => {
    const r = _buildResult(
      [],
      [],
      [
        { severity: 'critical', rule: 'a11y/img-no-alt', fix: 'add alt' },
        { severity: 'critical', rule: 'a11y/non-semantic-interactive', fix: 'use button' },
      ],
      EVAL_VERSION
    );
    assert.equal(r.overall.score, 100 - 8 - 8);
    assert.equal(r.overall.score, 84);
    assert.equal(r.overall.grade, 'B');
  });

  test('1 major a11y → score 96', () => {
    const r = _buildResult(
      [], [],
      [{ severity: 'major', rule: 'a11y/positive-tabindex', fix: 'use 0' }],
      EVAL_VERSION
    );
    assert.equal(r.overall.score, 96);
  });

  test('3 token findings → score 94 (3 × -2)', () => {
    const r = _buildResult(
      [],
      [
        { rule: 'tokens/color', severity: 'error', snippet: '#ff0000', fix: 'use token' },
        { rule: 'tokens/color', severity: 'error', snippet: '#00ff00', fix: 'use token' },
        { rule: 'tokens/spacing', severity: 'warning', snippet: 'margin: 7px', fix: 'use scale' },
      ],
      [],
      EVAL_VERSION
    );
    assert.equal(r.overall.score, 94);
  });

  test('score clamps at 0 when huge penalties', () => {
    const antiSlop = Array.from({ length: 20 }, () => ({
      severity: 'critical', rule: 'x', description: 'x',
    }));
    const r = _buildResult(antiSlop, [], [], EVAL_VERSION);
    assert.equal(r.overall.score, 0);
    assert.equal(r.overall.grade, 'F');
  });

  test('per-dim subscore clamps independently', () => {
    // 20 critical a11y = -160 penalty, subscore clamped to 0
    const a11y = Array.from({ length: 20 }, () => ({
      severity: 'critical', rule: 'a11y/img-no-alt', fix: 'add alt',
    }));
    const r = _buildResult([], [], a11y, EVAL_VERSION);
    assert.equal(r.dimensions.a11y.score, 0);
    // Overall also clamped to 0
    assert.equal(r.overall.score, 0);
  });

  test('grade band boundaries', () => {
    assert.equal(_buildResult([], [], [], EVAL_VERSION).overall.grade, 'A'); // 100
    // Manufacture exactly 90: need -10 → 10 warns
    const r90 = _buildResult(
      Array.from({ length: 10 }, () => ({ severity: 'warn', rule: 'x', description: '' })),
      [], [], EVAL_VERSION
    );
    assert.equal(r90.overall.score, 90);
    assert.equal(r90.overall.grade, 'A');

    // B = 80..89
    const r80 = _buildResult(
      Array.from({ length: 20 }, () => ({ severity: 'warn', rule: 'x', description: '' })),
      [], [], EVAL_VERSION
    );
    assert.equal(r80.overall.score, 80);
    assert.equal(r80.overall.grade, 'B');

    // F < 60: use 6 criticals = -48 → 52
    const rF = _buildResult(
      Array.from({ length: 6 }, () => ({ severity: 'critical', rule: 'x', description: '' })),
      [], [], EVAL_VERSION
    );
    assert.equal(rF.overall.score, 52);
    assert.equal(rF.overall.grade, 'F');
  });

  test('result schema has all required fields', () => {
    const r = _buildResult([], [], [], EVAL_VERSION);
    assert.ok('overall' in r);
    assert.ok('score' in r.overall);
    assert.ok('grade' in r.overall);
    assert.ok('dimensions' in r);
    assert.ok('anti_slop' in r.dimensions);
    assert.ok('token_discipline' in r.dimensions);
    assert.ok('a11y' in r.dimensions);
    assert.ok('version' in r);
    assert.equal(r.version, EVAL_VERSION);
  });

  test('findings arrays have required fields', () => {
    const r = _buildResult(
      [{ severity: 'critical', rule: 'transition-all', description: 'transition: all' }],
      [{ rule: 'tokens/color', severity: 'error', snippet: '#f00', fix: 'use token', expected: '', file: '<inline>' }],
      [{ severity: 'major', rule: 'a11y/positive-tabindex', fix: 'use 0' }],
      EVAL_VERSION
    );
    const asf = r.dimensions.anti_slop.findings[0];
    assert.ok('rule' in asf);
    assert.ok('severity' in asf);
    assert.ok('message' in asf);
    const tf = r.dimensions.token_discipline.findings[0];
    assert.ok('rule' in tf);
    assert.equal(tf.severity, 'major');
    const a11yf = r.dimensions.a11y.findings[0];
    assert.ok('rule' in a11yf);
    assert.ok('severity' in a11yf);
  });
});

// ─── 2. a11y-static unit tests ────────────────────────────────────────────────

describe('scanA11y — check 1: a11y/img-no-alt', () => {
  test('fires on <img src="..." /> without alt', () => {
    const findings = scanA11y('<img src="banner.png" />');
    const hit = findings.find(f => f.rule === 'a11y/img-no-alt');
    assert.ok(hit, 'expected a11y/img-no-alt finding');
    assert.equal(hit.severity, 'critical');
  });

  test('skips <img> with alt=""', () => {
    const findings = scanA11y('<img src="banner.png" alt="" />');
    assert.ok(!findings.find(f => f.rule === 'a11y/img-no-alt'));
  });

  test('skips <img> with alt="descriptive"', () => {
    const findings = scanA11y('<img src="photo.jpg" alt="A scenic mountain" width={800} height={600} />');
    assert.ok(!findings.find(f => f.rule === 'a11y/img-no-alt'));
  });

  test('skips aria-hidden="true" img (decorative)', () => {
    const findings = scanA11y('<img src="icon.svg" aria-hidden="true" />');
    assert.ok(!findings.find(f => f.rule === 'a11y/img-no-alt'));
  });

  test('skips role="presentation" img', () => {
    const findings = scanA11y('<img src="bg.png" role="presentation" />');
    assert.ok(!findings.find(f => f.rule === 'a11y/img-no-alt'));
  });
});

describe('scanA11y — check 2: a11y/non-semantic-interactive', () => {
  test('fires on <div onClick> without role or tabIndex', () => {
    const findings = scanA11y('<div onClick={handleClick}>Submit</div>');
    const hit = findings.find(f => f.rule === 'a11y/non-semantic-interactive');
    assert.ok(hit, 'expected non-semantic-interactive finding');
    assert.equal(hit.severity, 'critical');
  });

  test('fires on <span onClick> without role', () => {
    const findings = scanA11y('<span onClick={fn}>Click me</span>');
    const hit = findings.find(f => f.rule === 'a11y/non-semantic-interactive');
    assert.ok(hit);
  });

  test('does NOT fire when role= is present', () => {
    const findings = scanA11y('<div role="button" onClick={fn}>Submit</div>');
    assert.ok(!findings.find(f => f.rule === 'a11y/non-semantic-interactive'));
  });

  test('does NOT fire when tabIndex is present', () => {
    const findings = scanA11y('<div onClick={fn} tabIndex={0}>Submit</div>');
    assert.ok(!findings.find(f => f.rule === 'a11y/non-semantic-interactive'));
  });

  test('does NOT fire on <button onClick>', () => {
    const findings = scanA11y('<button onClick={fn}>Submit</button>');
    assert.ok(!findings.find(f => f.rule === 'a11y/non-semantic-interactive'));
  });
});

describe('scanA11y — check 3: a11y/positive-tabindex', () => {
  test('fires on tabIndex={1}', () => {
    const findings = scanA11y('<button tabIndex={1}>Foo</button>');
    const hit = findings.find(f => f.rule === 'a11y/positive-tabindex');
    assert.ok(hit, 'expected positive-tabindex finding');
    assert.equal(hit.severity, 'major');
  });

  test('fires on tabIndex={3}', () => {
    const findings = scanA11y('<input tabIndex={3} />');
    assert.ok(findings.find(f => f.rule === 'a11y/positive-tabindex'));
  });

  test('does NOT fire on tabIndex={0}', () => {
    const findings = scanA11y('<button tabIndex={0}>OK</button>');
    assert.ok(!findings.find(f => f.rule === 'a11y/positive-tabindex'));
  });

  test('does NOT fire on tabIndex={-1}', () => {
    const findings = scanA11y('<div tabIndex={-1}>hidden focus</div>');
    assert.ok(!findings.find(f => f.rule === 'a11y/positive-tabindex'));
  });

  test('fires on HTML attr tabindex="2"', () => {
    const findings = scanA11y('<button tabindex="2">OK</button>');
    assert.ok(findings.find(f => f.rule === 'a11y/positive-tabindex'));
  });
});

describe('scanA11y — check 4: a11y/aria-invalid-no-describedby', () => {
  test('fires on aria-invalid="true" without aria-describedby', () => {
    const findings = scanA11y('<input aria-invalid="true" />');
    const hit = findings.find(f => f.rule === 'a11y/aria-invalid-no-describedby');
    assert.ok(hit, 'expected aria-invalid-no-describedby finding');
    assert.equal(hit.severity, 'major');
  });

  test('does NOT fire when aria-describedby is present', () => {
    const findings = scanA11y('<input aria-invalid="true" aria-describedby="err-msg" />');
    assert.ok(!findings.find(f => f.rule === 'a11y/aria-invalid-no-describedby'));
  });

  test('does NOT fire on aria-invalid="false"', () => {
    const code = '<input aria-invalid="false" />';
    const findings = scanA11y(code);
    assert.ok(!findings.find(f => f.rule === 'a11y/aria-invalid-no-describedby'));
  });
});

describe('scanA11y — check 5: a11y/no-reduced-motion', () => {
  test('fires on file with transition: but no prefers-reduced-motion', () => {
    const code = `.card { transition: opacity 0.3s ease; }`;
    const findings = scanA11y(code);
    const hit = findings.find(f => f.rule === 'a11y/no-reduced-motion');
    assert.ok(hit, 'expected no-reduced-motion finding');
    assert.equal(hit.severity, 'major');
  });

  test('does NOT fire when prefers-reduced-motion is present', () => {
    const code = `
.card { transition: opacity 0.3s ease; }
@media (prefers-reduced-motion: reduce) {
  .card { transition: none; }
}`;
    const findings = scanA11y(code);
    assert.ok(!findings.find(f => f.rule === 'a11y/no-reduced-motion'));
  });

  test('fires on animation: without prefers-reduced-motion', () => {
    const code = `.spinner { animation: spin 1s linear infinite; }`;
    const findings = scanA11y(code);
    assert.ok(findings.find(f => f.rule === 'a11y/no-reduced-motion'));
  });

  test('does NOT fire on files with no animation at all', () => {
    const code = `<div className="p-4 bg-white rounded">Hello</div>`;
    const findings = scanA11y(code);
    assert.ok(!findings.find(f => f.rule === 'a11y/no-reduced-motion'));
  });
});

// ─── 3. Edge / bad input tests ────────────────────────────────────────────────

describe('scoreUI — edge cases', () => {
  test('empty string → score 100, no findings', async () => {
    const r = await scoreUI({ code: '' });
    assert.equal(r.overall.score, 100);
    assert.equal(r.overall.grade, 'A');
  });

  test('nonexistent path → error field present, no throw', async () => {
    const r = await scoreUI({ path: '/nonexistent/path/to/file.tsx' });
    assert.ok('error' in r, 'expected error field');
    assert.ok(!('overall' in r), 'should not have overall when error');
  });

  test('bare string path → accepts it (treats as file path)', async () => {
    const r = await scoreUI(fixturePath('designer/clean-card.tsx'));
    assert.ok('overall' in r);
  });
});

// ─── 4. Regression fixture tests ─────────────────────────────────────────────

describe('regression — fixtures within baselines.json bands', () => {
  const baselineRaw = readFileSync(join(__dir, 'baselines.json'), 'utf8');
  const baselines = JSON.parse(baselineRaw);
  const { fixtures } = baselines;

  const slopScores = [];
  const designerScores = [];

  for (const [relPath, band] of Object.entries(fixtures)) {
    const absPath = join(REPO_ROOT, relPath);
    const isDesigner = relPath.includes('/designer/');

    test(`${relPath} within band [${band.scoreMin}, ${band.scoreMax}]`, async () => {
      const r = await scoreUI({ path: absPath });
      if (r.error) {
        assert.fail(`scoreUI error for ${relPath}: ${r.error}`);
      }
      const { score } = r.overall;
      if (isDesigner) designerScores.push(score);
      else slopScores.push(score);
      assert.ok(
        score >= band.scoreMin && score <= band.scoreMax,
        `${relPath} scored ${score} — outside band [${band.scoreMin}, ${band.scoreMax}]`
      );
    });
  }

  // ─── 5. Separation assertion ──────────────────────────────────────────────
  test('designer scores all exceed slop scores (separation)', async () => {
    // Score all fixtures now (tests above already run but we need the values here)
    const slopPaths = Object.keys(fixtures).filter(p => p.includes('/slop/'));
    const designerPaths = Object.keys(fixtures).filter(p => p.includes('/designer/'));

    const slopResults = await Promise.all(
      slopPaths.map(p => scoreUI({ path: join(REPO_ROOT, p) }))
    );
    const designerResults = await Promise.all(
      designerPaths.map(p => scoreUI({ path: join(REPO_ROOT, p) }))
    );

    const slopMax = Math.max(...slopResults.map(r => r.overall?.score ?? 0));
    const designerMin = Math.min(...designerResults.map(r => r.overall?.score ?? 0));

    assert.ok(
      designerMin > slopMax,
      `Separation failed: min designer score (${designerMin}) must be > max slop score (${slopMax})`
    );
  });
});

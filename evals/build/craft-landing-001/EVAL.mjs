/**
 * craft-landing-001 — scorer
 *
 * Mechanises the B1 checklist from evals/craft-quality/PROMPTS.md.
 *
 * The hero-subtext check is the reason this file exists. On the first blind audit a landing
 * build shipped a 32-word hero subtext against a ≤20 limit that recipe-landing.md has stated
 * in two places for months. The limit was never soft — it was never loaded. A numeric rule
 * nobody measures is a suggestion, and this is the measurement.
 */

export default async function score(ctx) {
  // ── Transcript: Craft Read, marketing register ────────────────────────────
  // Anchored to line start on purpose. Unanchored, this matched SKILL.md's own
  // sentence — "output the **Craft Read** from craft-intent.md" — whenever the agent's
  // turn quoted the instruction, so the check passed while measuring nothing. An emitted
  // read opens a line; a reference to one sits mid-sentence.
  const craftRead = ctx.preCode.match(/^[\s>*_-]*\**Craft Read\**:?\s*\**([^\n]{20,400})/im);
  ctx.checkOrdered(
    'Craft Read line emitted',
    Boolean(craftRead),
    craftRead ? craftRead[0].slice(0, 200) : 'no "Craft Read:" line before the first file write'
  );

  const line = craftRead?.[1] ?? '';
  ctx.check(
    'Craft Read names marketing language',
    /\bmarketing\b/i.test(line),
    line ? `line: ${line.slice(0, 160)}` : 'no Craft Read line to inspect'
  );
  // SKILL.md Knobs: landings default DESIGN_VARIANCE 7.
  const variance = Number(line.match(/variance\s*[:=]?\s*(\d+)/i)?.[1] ?? NaN);
  ctx.check(
    'variance is a marketing value (6-8)',
    variance >= 6 && variance <= 8,
    Number.isNaN(variance) ? 'no variance declared' : `declared variance ${variance}; landings default 7`
  );
  ctx.check(
    'Craft Read names a signature bet',
    /signature bet\s*[:=]/i.test(line),
    line ? `line: ${line.slice(0, 160)}` : 'no Craft Read line to inspect'
  );

  // ── Hero discipline ───────────────────────────────────────────────────────
  //
  // recipe-landing.md: "Max 4 text elements: one eyebrow/badge (or none), headline
  // (≤2 lines desktop), subtext (≤20 words, ≤4 lines), CTAs".
  const hero = ctx.file('Hero.jsx') ?? ctx.file('Hero.tsx') ?? ctx.file('hero.tsx');
  ctx.check('hero component exists', Boolean(hero), hero ? 'found' : 'no Hero component in the workspace');

  if (hero) {
    // The subtext is the first <p> after the <h1> — the paragraph the eye lands on second.
    const afterH1 = hero.split(/<h1[\s\S]*?<\/h1>/)[1] ?? '';
    const firstP = afterH1.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const words = firstP ? ctx.wordCount(firstP[1]) : 0;
    ctx.check(
      'hero subtext ≤20 words',
      Boolean(firstP) && words <= 20,
      firstP
        ? `${words} words: "${ctx.visibleText(firstP[1]).slice(0, 120)}"`
        : 'no paragraph found after the hero headline'
    );

    // Asymmetry: a hero that splits its columns evenly reads as a template. An explicit
    // ratio (or a single dominant column) is the tell that a composition was chosen.
    const gridCls = hero.match(/grid-cols-\[([^\]]+)\]/);
    const evenSplit = /(?:lg:|md:)?grid-cols-2\b/.test(hero) && !gridCls;
    ctx.check(
      'hero composition is asymmetric',
      Boolean(gridCls) || !evenSplit,
      gridCls ? `explicit ratio grid-cols-[${gridCls[1]}]` : evenSplit ? 'even grid-cols-2 split' : 'no even 2-col split'
    );

    // recipe-landing.md: "no logo wall or trust strip inside the hero" — it belongs below.
    const logoInHero = /<(?:LogoStrip|LogoWall|LogoCloud|TrustStrip|TrustBar)\b/.test(hero);
    ctx.check(
      'no logo wall or trust strip inside the hero',
      !logoInHero,
      logoInHero ? 'a logo/trust component is rendered inside Hero' : 'logo wall is not in the hero'
    );
  }

  // ── Section grammar ───────────────────────────────────────────────────────
  //
  // SKILL.md: "Features: 2-3 asymmetric rows with real visuals. NEVER uniform 3-column
  // icon grids."
  const features = ctx.file('Features.jsx') ?? ctx.file('Features.tsx');
  if (features) {
    const threeCol = /(?:lg:|md:)?grid-cols-3\b/.test(features);
    ctx.check(
      'features are not a uniform 3-column icon grid',
      !threeCol,
      threeCol ? 'grid-cols-3 in the features section' : 'no 3-column grid in features'
    );
  }

  // SKILL.md anti-slop: "Uppercase tracked eyebrow above every section heading — ration to
  // max 1 per 3 sections". Budget = ceil(sections / 3).
  const app = ctx.file('App.jsx') ?? ctx.file('App.tsx') ?? ctx.file('page.tsx') ?? '';
  const sections = [...app.matchAll(/<([A-Z][A-Za-z]*)\s*\/?>/g)]
    .map((m) => m[1])
    .filter((n) => !/^(Nav|Navbar|Header|Footer|Fragment)$/.test(n));
  const eyebrows = ctx.match(/\.(jsx|tsx)$/).reduce(
    (n, [, src]) => n + [...src.matchAll(/className="[^"]*\buppercase\b[^"]*"/g)].length,
    0
  );
  const budget = Math.max(1, Math.ceil(sections.length / 3));
  ctx.check(
    `eyebrow count within budget (≤${budget} for ${sections.length} sections)`,
    eyebrows <= budget,
    `${eyebrows} uppercase label(s) across the page, budget ${budget}`
  );

  // SKILL.md anti-slop: numbered section eyebrows, and scroll cues.
  const numbered = ctx.find(/>\s*0[1-9]\s*[·/|—-]\s*[A-Z]/);
  ctx.check(
    'no numbered section eyebrows',
    !numbered,
    numbered ? `${numbered.file}: ${numbered.match.trim()}` : 'no numbered eyebrows'
  );

  const scrollCue = ctx.find(/Scroll to explore|scroll down|↓\s*<\/|Scroll for more/i);
  ctx.check(
    'no scroll cue',
    !scrollCue,
    scrollCue ? `${scrollCue.file}: ${scrollCue.match.trim()}` : 'no scroll cue'
  );

  // ── CTA discipline ────────────────────────────────────────────────────────
  //
  // SKILL.md anti-slop: "Generic CTAs ('Learn more', 'Click here')" and "Two CTA labels
  // with the same intent on one page — one label per intent, reused everywhere".
  const buttonLabels = ctx
    .match(/\.(jsx|tsx)$/)
    .flatMap(([, src]) => [...src.matchAll(/<(?:button|a)[^>]*>\s*([^<>{][^<]{2,40}?)\s*<\/(?:button|a)>/g)])
    .map((m) => m[1].replace(/\s+/g, ' ').trim());

  const generic = buttonLabels.filter((l) => /^(learn more|click here|get started|read more|submit)$/i.test(l));
  ctx.check(
    'no generic CTA labels',
    generic.length === 0,
    generic.length ? `generic: ${[...new Set(generic)].join(', ')}` : `labels: ${[...new Set(buttonLabels)].slice(0, 6).join(' | ') || 'none parsed'}`
  );

  const trialLabels = [...new Set(buttonLabels.filter((l) => /trial|sign ?up|start|try/i.test(l)))];
  ctx.check(
    'one CTA label per intent, reused',
    trialLabels.length <= 1,
    trialLabels.length ? `signup-intent labels: ${trialLabels.join(' | ')}` : 'no signup CTA label parsed'
  );

  // ── Screenshot honesty ────────────────────────────────────────────────────
  //
  // SKILL.md anti-slop: "Fake product screenshots built from styled <div> rectangles — use
  // a real screenshot, a real mini component, or editorial imagery; never a div mockup."
  // The prompt says a live product exists, so an <img> (or a labelled slot) is the ask.
  const shot = ctx.file('ProductScreenshot.jsx') ?? ctx.file('Screenshot.jsx') ?? ctx.file('Hero.jsx') ?? '';
  ctx.check(
    'product visual is an image or labelled slot, not a div mockup',
    /<img[\s>]|<picture[\s>]|<video[\s>]|screenshot/i.test(shot),
    /<img[\s>]/.test(shot) ? 'an <img> carries the product visual' : 'no <img>/<picture> found for the product visual'
  );

  // ── Deterministic floor ───────────────────────────────────────────────────
  const scored = await ctx.score();
  ctx.check(
    'worst-file UICraftScore ≥ 70',
    scored.min >= 70,
    scored.worst
      ? `worst ${scored.worst.file} scored ${scored.min} (${scored.worst.grade}); mean ${scored.mean} across ${scored.files.length} files`
      : 'no scoreable files in the workspace'
  );

  const findings = await ctx.detect();
  const errors = (findings?.findings ?? []).filter((f) => f.severity === 'error');
  ctx.check(
    'no anti-slop errors',
    errors.length === 0,
    errors.length ? errors.slice(0, 3).map((f) => `${f.rule} @ ${f.file}:${f.line}`).join('; ') : '0 errors'
  );
}

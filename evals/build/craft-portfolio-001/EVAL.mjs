/**
 * craft-portfolio-001 — scorer
 *
 * Mechanises the B2 checklist from evals/craft-quality/PROMPTS.md.
 *
 * Portfolio is the highest-variance surface the skill ships (DESIGN_VARIANCE 8), which makes
 * it the one where "safe" reads as failure. So the checks here look for evidence of a
 * decision — an explicit grid ratio, emphasis inside one type family — rather than for the
 * absence of tells. A portfolio can be free of every anti-slop pattern and still be a
 * forgettable three-column card grid.
 */

export default async function score(ctx) {
  const craftRead = ctx.preCode.match(/^[\s>*_-]*\**Craft Read\**:?\s*\**([^\n]{20,400})/im);
  ctx.checkOrdered(
    'Craft Read line emitted',
    Boolean(craftRead),
    craftRead ? craftRead[0].slice(0, 200) : 'no "Craft Read:" line before the first file write'
  );

  const line = craftRead?.[1] ?? '';
  // SKILL.md Knobs: portfolios default DESIGN_VARIANCE 8.
  const variance = Number(line.match(/variance\s*[:=]?\s*(\d+)/i)?.[1] ?? NaN);
  ctx.check(
    'variance is an expressive value (7-10)',
    variance >= 7 && variance <= 10,
    Number.isNaN(variance) ? 'no variance declared' : `declared variance ${variance}; portfolios default 8`
  );

  const all = ctx.all();

  // ── One hero project, not four equal cards ────────────────────────────────
  //
  // The B2 checklist asks for one hero project above the fold. Four peers in a uniform grid
  // is the failure: nothing leads, so the eye has no entry point.
  const uniformGrid = /(?:lg:|md:)?grid-cols-(?:2|4)\b/.test(all) && !/col-span-|row-span-|grid-cols-\[/.test(all);
  ctx.check(
    'project grid is not four uniform peers',
    !uniformGrid,
    uniformGrid
      ? 'an even grid with no span or ratio overrides — nothing leads'
      : /col-span-|row-span-|grid-cols-\[/.test(all)
        ? 'spans or an explicit ratio break the grid'
        : 'no uniform 2/4-column grid'
  );

  // ── Display type: emphasis inside one family ──────────────────────────────
  //
  // B2: "display-scale headline with emphasis in the same family (italic/bold), not random
  // serif injection". A second family appearing only in the headline is the tell.
  const families = [...all.matchAll(/font-(serif|mono|display|sans)\b/g)].map((m) => m[1]);
  const distinct = [...new Set(families)];
  ctx.check(
    'no third typeface injected for effect',
    distinct.length <= 2,
    distinct.length ? `type families in play: ${distinct.join(', ')}` : 'no explicit font-family utilities'
  );

  const displayScale = /text-\[(?:[6-9]\d|1\d{2})px\]|text-(?:6|7|8|9)xl\b/.test(all);
  ctx.check(
    'headline reaches display scale',
    displayScale,
    displayScale ? 'a 60px+ or 6xl+ heading is present' : 'no display-scale heading — nothing carries the page'
  );

  // ── Imagery, not div mockups ──────────────────────────────────────────────
  //
  // SKILL.md anti-slop: "Fake product screenshots built from styled <div> rectangles".
  const realMedia = /<img[\s>]|<picture[\s>]|<video[\s>]|backgroundImage|bg-\[url\(/.test(all);
  const labelledSlot = /placeholder|aspect-\[|aspect-video|aspect-square/i.test(all);
  ctx.check(
    'projects use imagery or labelled slots',
    realMedia || labelledSlot,
    realMedia ? 'real media elements present' : labelledSlot ? 'labelled aspect-ratio slots present' : 'neither media nor slots — likely div mockups'
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

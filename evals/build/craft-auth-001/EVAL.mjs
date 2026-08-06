/**
 * craft-auth-001 — scorer
 *
 * Mechanises the A2 checklist from evals/craft-quality/PROMPTS.md.
 *
 * The panel check is the one worth having. `recipe-auth.md` calls a full-bleed saturated
 * brand panel beside a sign-in form an anti-slop tell, and it is the single most common way
 * an auth page announces itself as generated — a wall of brand colour doing the job a piece
 * of proof should do.
 */

export default async function score(ctx) {
  // ── Transcript ────────────────────────────────────────────────────────────
  const craftRead = ctx.preCode.match(/^[\s>*_-]*\**Craft Read\**:?\s*\**([^\n]{20,400})/im);
  ctx.check(
    'Craft Read line emitted',
    Boolean(craftRead),
    craftRead ? craftRead[0].slice(0, 200) : 'no "Craft Read:" line before the first file write'
  );

  const line = craftRead?.[1] ?? '';
  const variance = Number(line.match(/variance\s*[:=]?\s*(\d+)/i)?.[1] ?? NaN);
  ctx.check(
    'variance is a product-surface value (3-5)',
    variance >= 3 && variance <= 5,
    Number.isNaN(variance) ? 'no variance declared' : `declared variance ${variance}; auth defaults 4`
  );
  ctx.check(
    'Craft Read names a signature bet',
    /signature bet\s*[:=]/i.test(line),
    line ? `line: ${line.slice(0, 160)}` : 'no Craft Read line to inspect'
  );

  // ── The proof panel ───────────────────────────────────────────────────────
  //
  // recipe-auth.md / SKILL.md anti-slop: "Full-bleed saturated brand panel beside a sign-in
  // form — tinted neutral surface with one proof asset."
  const all = ctx.all();
  const saturatedPanel = ctx.find(
    /className=(?:"[^"]*|\{`[^`]*)\bbg-(?:indigo|blue|violet|purple|emerald|cyan|rose|orange)-(?:5|6|7|8|9)\d{2}\b/
  );
  ctx.check(
    'proof panel is tinted, not a saturated brand flood',
    !saturatedPanel,
    saturatedPanel
      ? `${saturatedPanel.file}: ${saturatedPanel.match.slice(0, 80)}`
      : 'no saturated brand background on a panel'
  );

  // ── Form column width ─────────────────────────────────────────────────────
  //
  // recipe-auth.md: the form column sits ~360-400px. Wider and it stops reading as a form.
  const widths = [...all.matchAll(/max-w-\[(\d+)px\]/g)].map((m) => Number(m[1]));
  const named = /max-w-(sm|md)\b/.test(all); // sm=384px, md=448px
  const inBand = widths.some((w) => w >= 340 && w <= 420);
  ctx.check(
    'form column is roughly 360-400px',
    inBand || /max-w-sm\b/.test(all),
    widths.length
      ? `explicit widths: ${widths.join(', ')}px`
      : named
        ? 'uses a named max-w (sm=384px is in band, md=448px is not)'
        : 'no max-width found on the form column'
  );

  // ── The divider ───────────────────────────────────────────────────────────
  //
  // SKILL.md anti-slop: '"OR" divider in caps between auth options — lowercase it'.
  const divider = all.match(/>\s*(or[^<]{0,24})\s*</i) ?? all.match(/>\s*(OR)\s*</);
  const shouty = divider && /^OR\b/.test(divider[1].trim());
  ctx.check(
    'divider is lowercase, not a shouty OR',
    Boolean(divider) && !shouty,
    divider ? `divider text: "${divider[1].trim()}"` : 'no or-divider found between auth options'
  );

  // ── Accent discipline ─────────────────────────────────────────────────────
  //
  // recipe-auth.md: accent on the submit button and links only. Counting accent-tinted
  // backgrounds is the cheap proxy — an auth page has few enough surfaces for it to hold.
  const accentBgs = [...all.matchAll(/\bbg-(?:accent|primary|brand)\b/g)].length;
  ctx.check(
    'accent is not spread across the page',
    accentBgs <= 3,
    `${accentBgs} accent background(s) — the submit button is one; links carry colour, not fills`
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

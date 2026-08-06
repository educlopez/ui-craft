/**
 * craft-dashboard-002-seeded — scorer
 *
 * The Tier-1 re-measure. Every other build eval runs in an empty directory, which means the
 * evidence behind the Tier-1 restructure could not speak for `brief.md` or `tokens.md`: the
 * files those references teach you to read did not exist, so their absence from the read log
 * proved nothing.
 *
 * This eval hands the agent a project that already has both, plus a token spine in CSS. Now
 * "did it read the brief" is a real question with a real answer, and so is the one that
 * matters more: did reading it change the output.
 *
 * The learned constraints in the seed are the sharpest instrument here. They contradict what
 * the skill would otherwise do — a coloured delta pill is normal elsewhere, a tinted sidebar
 * is the skill's own default — so honouring them can only come from having read the brief.
 */

export default async function score(ctx) {
  ctx.check(
    'the seed was provisioned',
    ctx.seedFiles().length >= 3,
    `${ctx.seedFiles().length} seed file(s): brief, tokens, token CSS`
  );

  // ── Did it read what the project already had ──────────────────────────────
  const readBrief = ctx.refsRead.includes('brief');
  const readTokens = ctx.refsRead.includes('tokens');
  ctx.check(
    'reference reads recorded',
    ctx.refsRead.length > 0,
    ctx.refsRead.length ? `read before writing: ${ctx.refsRead.join(', ')}` : 'no reference reads recorded'
  );
  // Reported, not required. The reference is the format guide; reading the project's OWN
  // brief matters more, and that is what the constraint checks below actually test.
  ctx.check(
    'brief.md or tokens.md consulted, or their content honoured',
    true,
    `brief.md ${readBrief ? 'read' : 'not read'} · tokens.md ${readTokens ? 'read' : 'not read'} — ` +
      'informational: what counts is whether the project brief changed the output, below'
  );

  // Same gate its five siblings apply. Omitting it here would have let this eval report a
  // clean sweep while the build skipped the one artifact every other surface is measured on.
  const craftRead = ctx.preCode.match(/^[\s>*_-]*\**Craft Read\**:?\s*\**([^\n]{20,400})/im);
  ctx.check(
    'Craft Read line emitted',
    Boolean(craftRead),
    craftRead ? craftRead[0].slice(0, 200) : 'no "Craft Read:" line before the first file write'
  );

  const all = ctx.all();

  // ── Did the existing token spine get used, or replaced ────────────────────
  //
  // The project ships semantic tokens. A build that invents `bg-slate-50` beside them has
  // started a second system, which is the failure the skill's Discovery phase exists to stop.
  const usesTokens = /var\(--(?:accent|surface|line|text|bg|gray-\d|teal-\d|radius|space)/.test(all) ||
    /\b(?:bg|text|border)-\[var\(--/.test(all);
  ctx.check(
    "the project's own tokens are used",
    usesTokens,
    usesTokens ? 'semantic custom properties referenced in the new screen' : 'no reference to the existing token spine'
  );

  const rawHex = ctx.find(/#[0-9a-f]{6}\b/i);
  ctx.check(
    'no raw hex beside an existing token spine',
    !rawHex,
    rawHex ? `${rawHex.file}: ${rawHex.match}` : 'no raw hex values'
  );

  // ── The learned constraints ───────────────────────────────────────────────
  //
  // These are the whole point. Both contradict the skill's defaults, so honouring them is
  // only possible by having read this project's brief.
  const colouredDelta = ctx.find(
    /className=(?:"[^"]*|\{`[^`]*)\b(?:bg|text)-(?:green|emerald|red|rose)-\d{2,3}\b[^"`]*(?:"|`)/
  );
  ctx.check(
    'learned constraint: no coloured delta pills',
    !colouredDelta,
    colouredDelta
      ? `${colouredDelta.file}: ${colouredDelta.match.slice(0, 90)} — the brief records a real misread from this`
      : 'no red/green delta styling'
  );

  const sidebarSrc = ctx.component(['sidebar', 'nav', 'rail'])?.src ?? '';
  const darkRail = /\bbg-(?:black|gray-9\d{2}|zinc-9\d{2}|slate-9\d{2}|neutral-9\d{2})\b/.test(sidebarSrc);
  ctx.check(
    'learned constraint: sidebar stays light',
    !darkRail,
    darkRail
      ? 'a dark rail was built — the brief records that this was tried and rejected'
      : sidebarSrc
        ? 'sidebar is light'
        : 'no sidebar in this screen (the shell already exists) — constraint not exercised'
  );

  // ── The brief's standing rules ────────────────────────────────────────────
  const hasNumbers = /\$|\d{2,3}[.,]\d{2}|amount|balance|total/i.test(all);
  const tabular = /tabular-nums|font-variant-numeric/.test(all);
  ctx.check(
    "brief rule: numbers are tabular",
    !hasNumbers || tabular,
    hasNumbers ? (tabular ? 'tabular-nums present on numeric content' : 'numeric content with no tabular-nums — the brief says always') : 'no numeric content to judge'
  );

  const noDarkMode = !/dark:/.test(all);
  ctx.check(
    'brief rule: no dark mode variants',
    noDarkMode,
    noDarkMode ? 'no dark: variants' : 'dark: variants present — the brief says dark mode is not supported and will not be'
  );

  // ── Deterministic floor ───────────────────────────────────────────────────
  const scored = await ctx.score();
  ctx.check(
    'worst-file UICraftScore ≥ 70',
    scored.min >= 70,
    scored.worst ? `worst ${scored.worst.file} scored ${scored.min} (${scored.worst.grade}); mean ${scored.mean}` : 'no scoreable files'
  );

  const findings = await ctx.detect();
  const errors = (findings?.findings ?? []).filter((f) => f.severity === 'error');
  ctx.check(
    'no anti-slop errors',
    errors.length === 0,
    errors.length ? errors.slice(0, 3).map((f) => `${f.rule} @ ${f.file}:${f.line}`).join('; ') : '0 errors'
  );
}

/**
 * craft-dashboard-001 — scorer
 *
 * Mechanises the A1 checklist from evals/craft-quality/PROMPTS.md, which was pass/fail by
 * human judgement until now. Every threshold here is quoted from the reference that owns
 * it, so a check that fails names the rule it broke rather than a number out of nowhere.
 *
 * The transcript checks come first on purpose: they are the half a directory cannot show.
 */

export default async function score(ctx) {
  // ── Transcript: the Craft Read, and that it came BEFORE the code ──────────
  //
  // craft-intent.md §1: "output **one line** the user can react to:
  //   **Craft Read:** *[surface kind] for [audience], [product | marketing] language,
  //   [theme/accent hint], variance [N], signature bet: [choice].*"
  //
  // Matched loosely on the label and strictly on the elements. The failure this catches is
  // an agent that produces the right decisions in an improvised shape — real, observed, and
  // invisible to any check that only reads files.
  // Anchored to line start on purpose. Unanchored, this matched SKILL.md's own
  // sentence — "output the **Craft Read** from craft-intent.md" — whenever the agent's
  // turn quoted the instruction, so the check passed while measuring nothing. An emitted
  // read opens a line; a reference to one sits mid-sentence.
  const craftRead = ctx.preCode.match(/^[\s>*_-]*\**Craft Read\**:?\s*\**([^\n]{20,400})/im);
  ctx.check(
    'Craft Read line emitted',
    Boolean(craftRead),
    craftRead ? craftRead[0].slice(0, 200) : 'no "Craft Read:" line before the first file write'
  );

  const line = craftRead?.[1] ?? '';
  ctx.check(
    'Craft Read names product language',
    /\bproduct\b/i.test(line),
    line ? `line: ${line.slice(0, 160)}` : 'no Craft Read line to inspect'
  );
  ctx.check(
    'Craft Read declares a variance',
    /variance\s*[:=]?\s*\d/i.test(line),
    line ? `line: ${line.slice(0, 160)}` : 'no Craft Read line to inspect'
  );
  // recipe-dashboard.md: dashboards default DESIGN_VARIANCE 4 — SKILL.md Knobs.
  const variance = Number(line.match(/variance\s*[:=]?\s*(\d+)/i)?.[1] ?? NaN);
  ctx.check(
    'variance is a product-surface value (3-5)',
    variance >= 3 && variance <= 5,
    Number.isNaN(variance) ? 'no variance declared' : `declared variance ${variance}; dashboards default 4`
  );
  ctx.check(
    'Craft Read names a signature bet',
    /signature bet\s*[:=]/i.test(line),
    line ? `line: ${line.slice(0, 160)}` : 'no Craft Read line to inspect'
  );

  // ── Workspace: the sidebar ────────────────────────────────────────────────
  //
  // dashboard.md: "Sidebar: subtle bg tint, NOT full dark (common AI pattern)."
  const sidebar = ctx.file('Sidebar.jsx') ?? ctx.file('Sidebar.tsx') ?? ctx.file('sidebar.tsx');
  ctx.check('sidebar component exists', Boolean(sidebar), sidebar ? 'found' : 'no Sidebar component in the workspace');

  if (sidebar) {
    const root = sidebar.match(/<(?:aside|nav|div)[^>]*className=(?:"([^"]*)"|\{`([^`]*)`\})/);
    const cls = root?.[1] ?? root?.[2] ?? '';
    const fullDark = /\bbg-(?:black|gray-9\d{2}|zinc-9\d{2}|slate-9\d{2}|neutral-9\d{2}|gray-950)\b/.test(cls);
    ctx.check(
      'sidebar is tinted, not full dark',
      !fullDark && /\bbg-/.test(cls),
      cls ? `sidebar root classes: ${cls.slice(0, 160)}` : 'could not read the sidebar root element classes'
    );
  }

  // ── Workspace: one hero metric ────────────────────────────────────────────
  //
  // dashboard.md: "Metric cards: primary gets accent tint; others neutral."
  // SKILL.md anti-slop: "NEVER identical colored top borders" / equal-weight KPI grids.
  const kpi = ctx.file('KpiCard.jsx') ?? ctx.file('MetricCard.jsx') ?? ctx.file('KPICard.jsx');
  const sizes = [...(kpi ?? '').matchAll(/text-\[(\d+)px\]|text-(\d?xl|3xl|4xl|5xl)/g)].map((m) => m[0]);
  const distinctSizes = new Set(sizes).size;
  ctx.check(
    'metric cards differentiate a hero from the rest',
    Boolean(kpi) && (distinctSizes >= 2 || /primary\s*\?/.test(kpi)),
    kpi
      ? `${distinctSizes} distinct value sizes${/primary\s*\?/.test(kpi) ? ' + a primary/secondary branch' : ''}`
      : 'no metric-card component found'
  );

  // ── Workspace: the table rules ────────────────────────────────────────────
  //
  // dashboard.md Data Tables: "Every table is wrapped in `overflow-x: auto`, and any table
  // over ~15 rows gets `position: sticky; top: 0` on `thead`."
  const tables = ctx.match(/(Table|table)\.(jsx|tsx)$/);
  const tableSrc = tables.map(([, src]) => src).join('\n') || ctx.all();
  const hasTable = /<table[\s>]/.test(tableSrc);
  if (hasTable) {
    const overflow = tableSrc.match(/overflow-x-auto|overflow-x:\s*auto|overflow-auto/);
    const anyOverflow = tableSrc.match(/overflow-[a-z-]+/);
    ctx.check(
      'table is wrapped in overflow-x',
      Boolean(overflow),
      overflow
        ? `found ${overflow[0]}`
        : anyOverflow
          ? `only ${anyOverflow[0]} — horizontal overflow is the one that keeps a table from clipping at 320px`
          : 'no overflow class anywhere near the table'
    );
    const sticky = tableSrc.match(/sticky[^"'`]*/);
    ctx.check(
      'table header is sticky',
      Boolean(sticky),
      sticky ? `found ${sticky[0].slice(0, 60)}` : 'thead has no sticky positioning'
    );
  }

  // ── Workspace: the loudest anti-slop tells ────────────────────────────────
  //
  // SKILL.md Critical: purple/cyan gradient everything, emoji as feature icons.
  const gradientTell = ctx.find(/bg-gradient-to-\w+\s+from-(purple|violet|fuchsia|indigo)-\d+/);
  ctx.check(
    'no purple/violet mesh gradient',
    !gradientTell,
    gradientTell ? `${gradientTell.file}: ${gradientTell.match}` : 'no purple gradient utilities found'
  );

  const emojiTell = ctx.find(/[\u{1F300}-\u{1FAFF}]/u);
  ctx.check(
    'no emoji standing in for icons',
    !emojiTell,
    emojiTell ? `${emojiTell.file}: ${emojiTell.match}` : 'no emoji in source'
  );

  // ── Deterministic floor ───────────────────────────────────────────────────
  //
  // Not a taste judgement: score_ui is the same scorer the MCP exposes. The band is the
  // one evals/quality/baselines.json uses for designer-grade fixtures.
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

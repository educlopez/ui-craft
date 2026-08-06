/**
 * craft-redesign-001 — scorer
 *
 * Mechanises the C1 checklist. The only eval with a seed, and the only one that can be
 * scored by comparison rather than by inspection: the question is not "is this good" but
 * "did it get better without losing anything".
 *
 * That makes it the strictest scorer here, because a redesign has two ways to fail and they
 * pull in opposite directions. It can preserve everything and change nothing, or it can
 * modernise beautifully and quietly drop a pricing tier, a heading level, a signup link.
 * The second failure is invisible in a screenshot and expensive in production.
 */

/** Visible headings by level, so a redesign cannot flatten the document outline. */
const headings = (src) =>
  [...src.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({
    level: Number(m[1]),
    text: m[2].replace(/\{[^}]*\}/g, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
  }));

const hrefs = (src) => [...src.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]);

export default async function score(ctx) {
  const seedSrc = ctx.seedFiles().map(([, s]) => s).join('\n');
  const nowSrc = ctx.all();

  ctx.check(
    'the seed was actually provisioned',
    ctx.seedFiles().length > 0,
    `${ctx.seedFiles().length} seed file(s) — without them this eval measures nothing`
  );

  // ── Audit before proposing ────────────────────────────────────────────────
  //
  // /redesign opens with an audit. The tell is that the agent read the existing files before
  // writing: a redesign that starts by writing has not looked at what it is replacing.
  const readBeforeWrite = ctx.toolUses.slice(0, ctx.toolUses.indexOf('Write') + 1 || undefined).includes('Read');
  ctx.check(
    'read the existing site before writing',
    readBeforeWrite,
    readBeforeWrite
      ? `tool order starts: ${ctx.toolUses.slice(0, 6).join(' → ')}`
      : `no Read before the first Write — tool order: ${ctx.toolUses.slice(0, 6).join(' → ') || 'none recorded'}`
  );

  const preserveTalk = /preserve|keep|retain|unchanged|existing/i.test(ctx.preCode);
  ctx.check(
    'states what it will preserve',
    preserveTalk,
    preserveTalk ? 'preserve language present before the first write' : 'no preserve list stated before writing'
  );

  // ── Nothing lost ──────────────────────────────────────────────────────────
  const before = headings(seedSrc);
  const after = headings(nowSrc);
  const lostLevels = [...new Set(before.map((h) => h.level))].filter(
    (l) => !after.some((h) => h.level === l)
  );
  ctx.check(
    'every heading level survives',
    lostLevels.length === 0,
    lostLevels.length
      ? `h${lostLevels.join(', h')} present before, gone after — the document outline was flattened`
      : `levels before: h${[...new Set(before.map((h) => h.level))].join(', h')} — all still present`
  );

  const beforeLinks = new Set(hrefs(seedSrc).filter((h) => h.startsWith('/')));
  const afterLinks = new Set(hrefs(nowSrc).filter((h) => h.startsWith('/')));
  const lostLinks = [...beforeLinks].filter((h) => !afterLinks.has(h));
  ctx.check(
    'every internal route survives',
    lostLinks.length === 0,
    lostLinks.length ? `dropped: ${lostLinks.join(', ')}` : `${beforeLinks.size} route(s) preserved`
  );

  // The three pricing tiers are the content most easily lost to a prettier layout.
  const tiersKept = ['Starter', 'Pro', 'Enterprise'].filter((t) => nowSrc.includes(t));
  ctx.check(
    'pricing tiers survive',
    tiersKept.length === 3,
    `${tiersKept.length}/3 kept${tiersKept.length < 3 ? ` — missing ${['Starter', 'Pro', 'Enterprise'].filter((t) => !tiersKept.includes(t)).join(', ')}` : ''}`
  );

  // ── Brand colour kept ─────────────────────────────────────────────────────
  //
  // The brief says keep the brand colour. #6a2ff5 is the one the seed uses; a redesign that
  // swaps it has solved the wrong problem — boldness belongs in type and composition.
  const brandKept = /6a2ff5/i.test(nowSrc) || /#6A2FF5/i.test(nowSrc);
  ctx.check(
    'brand colour retained',
    brandKept,
    brandKept ? 'the seed brand hex still appears' : 'the brand hex #6a2ff5 is gone — a new palette is not a redesign'
  );

  // ── It actually got better ────────────────────────────────────────────────
  const findings = await ctx.detect();
  const errorsAfter = (findings?.findings ?? []).filter((f) => f.severity === 'error').length;
  const totalAfter = (findings?.findings ?? []).length;
  // Measured on the seed when this eval was authored: 2 errors, 11 findings.
  ctx.check(
    'detector errors reduced to zero',
    errorsAfter === 0,
    `${errorsAfter} error(s) after; the seed shipped 2 (uppercase headings, emoji-as-icons)`
  );
  ctx.check(
    'total findings below the seed baseline of 11',
    totalAfter < 11,
    `${totalAfter} finding(s) after, against 11 before`
  );

  // ── The loudest dated tells are gone ──────────────────────────────────────
  const gradientHero = ctx.find(/linear-gradient\([^)]*#?6a2ff5[^)]*\)/i);
  ctx.check(
    'purple-to-cyan gradient hero is gone',
    !gradientHero,
    gradientHero ? `${gradientHero.file}: still gradient-filled` : 'no brand-gradient background remains'
  );

  const emojiIcon = ctx.find(/[\u{1F300}-\u{1FAFF}]/u);
  ctx.check(
    'emoji feature icons are gone',
    !emojiIcon,
    emojiIcon ? `${emojiIcon.file}: ${emojiIcon.match}` : 'no emoji in source'
  );

  const genericCta = /(?:>|["'])\s*Learn more\s*(?:<|["'])/i.test(nowSrc);
  ctx.check(
    'generic "Learn more" CTA replaced',
    !genericCta,
    genericCta ? 'still says "Learn more" — the seed used it twice' : 'no generic CTA label remains'
  );

  const scored = await ctx.score();
  ctx.check(
    'worst-file UICraftScore ≥ 70',
    scored.min >= 70,
    scored.worst
      ? `worst ${scored.worst.file} scored ${scored.min} (${scored.worst.grade}); mean ${scored.mean}`
      : 'no scoreable files'
  );
}

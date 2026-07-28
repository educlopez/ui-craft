// detect.test.mjs — CLI parity + scan() unit tests
// Uses node:test and node:assert (zero external deps).

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import {
  scan,
  scanUrl,
  buildClaudeHookSettings,
  buildCursorHookSettings,
  parseUnifiedDiff,
  filterFindingsByScope,
  resolveBaseRef,
  renderGHAWorkflow,
  renderReviewComments,
  renderMarkdownReport,
  parseWorkflowConfig,
  replaceMarkers,
  DEFAULT_GHA_CONFIG,
} from "./detect.mjs";
import {
  readFileNoFollow,
  readFileSnapshotNoFollow,
  writeFileNoFollow,
} from "./detect/engine.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DETECT_MJS = path.join(__dirname, "detect.mjs");
const SLOP_FIXTURE = path.join(__dirname, "fixtures", "slop.tsx");
const CLEAN_FIXTURE = path.join(__dirname, "fixtures", "clean.tsx");

// ---------------------------------------------------------------------------
// 2.2 — scan() on slop fixture: shape check
// ---------------------------------------------------------------------------
test("scan() on slop fixture returns {version, summary, findings} shape", async () => {
  const result = await scan(SLOP_FIXTURE);

  assert.ok(typeof result.version === "string", "version must be a string");
  assert.ok(typeof result.summary === "object", "summary must be an object");
  assert.ok(typeof result.summary.files_scanned === "number", "summary.files_scanned must be a number");
  assert.ok(typeof result.summary.files_flagged === "number", "summary.files_flagged must be a number");
  assert.ok(typeof result.summary.errors === "number", "summary.errors must be a number");
  assert.ok(typeof result.summary.warnings === "number", "summary.warnings must be a number");
  assert.ok(Array.isArray(result.findings), "findings must be an array");
  assert.ok(result.findings.length > 0, "slop fixture must produce at least one finding");
  // summary.warnings folds both "major" and "warn" severities together, so
  // errors + warnings === total findings length (not just warn-severity count).
  assert.equal(
    result.summary.errors + result.summary.warnings,
    result.findings.length,
    "summary totals must match findings count"
  );
});

// ---------------------------------------------------------------------------
// 2.4 — scan() on code string with known anti-slop pattern via temp fixture
//        (scan() accepts a path; slop fixture has purple-cyan gradient)
// ---------------------------------------------------------------------------
test("scan() on slop fixture detects purple-cyan gradient rule", async () => {
  const result = await scan(SLOP_FIXTURE);

  const gradientFinding = result.findings.find((f) => f.rule === "purple-cyan-gradient");
  assert.ok(gradientFinding, 'must find a finding with rule "purple-cyan-gradient"');
  assert.equal(gradientFinding.severity, "critical");
});

// ---------------------------------------------------------------------------
// 2.5 — scan() on clean fixture: no findings
// ---------------------------------------------------------------------------
test("scan() on clean fixture returns empty findings and summary.total === 0", async () => {
  const result = await scan(CLEAN_FIXTURE);

  assert.equal(result.findings.length, 0, "clean fixture must produce zero findings");
  assert.equal(result.summary.errors, 0, "errors must be 0 for clean fixture");
  assert.equal(result.summary.warnings, 0, "warnings must be 0 for clean fixture");
  assert.equal(result.summary.files_flagged, 0, "files_flagged must be 0 for clean fixture");
});

// ---------------------------------------------------------------------------
// craft-intent rules — copy/or-divider-caps + auth/brand-flood-panel
// ---------------------------------------------------------------------------
test("copy/or-divider-caps fires on <span>OR</span>, skips <option>OR</option>", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-ordivider-"));
  try {
    fs.writeFileSync(
      path.join(dir, "auth.tsx"),
      `export function Divider() {\n  return (\n    <form>\n      <input type="password" />\n      <span className="text-xs">OR</span>\n    </form>\n  );\n}\n`,
    );
    fs.writeFileSync(
      path.join(dir, "states.tsx"),
      `export function States() {\n  return <select><option value="OR">OR</option></select>;\n}\n`,
    );
    const result = await scan(dir);
    const hits = result.findings.filter((f) => f.rule === "copy/or-divider-caps");
    assert.equal(hits.length, 1, "exactly one finding (auth.tsx), Oregon <option> skipped");
    assert.ok(hits[0].file.endsWith("auth.tsx"));
    assert.equal(hits[0].severity, "major");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("copy/or-divider-caps does NOT fire on <span>OR</span> in a non-auth address context", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-ordivider-address-"));
  try {
    fs.writeFileSync(
      path.join(dir, "address.tsx"),
      `export function Address() {\n  return <p>Portland, <span>OR</span> 97201</p>;\n}\n`,
    );
    const result = await scan(dir);
    const hits = result.findings.filter((f) => f.rule === "copy/or-divider-caps");
    assert.equal(hits.length, 0, "Oregon state abbreviation outside any auth context must not fire");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("auth/brand-flood-panel fires on saturated full-height panel next to password input", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-brandflood-"));
  try {
    fs.writeFileSync(
      path.join(dir, "signin.tsx"),
      [
        `export function SignIn() {`,
        `  return (`,
        `    <div className="flex">`,
        `      <aside className="min-h-screen w-1/2 bg-indigo-600" />`,
        `      <form><input type="password" autoComplete="current-password" /></form>`,
        `    </div>`,
        `  );`,
        `}`,
        ``,
      ].join("\n"),
    );
    // Same flood panel but NO password input → not an auth screen, must not fire.
    fs.writeFileSync(
      path.join(dir, "marketing.tsx"),
      `export function Hero() {\n  return <div className="min-h-screen bg-indigo-600" />;\n}\n`,
    );
    const result = await scan(dir);
    const hits = result.findings.filter((f) => f.rule === "auth/brand-flood-panel");
    assert.equal(hits.length, 1, "fires only on the auth file");
    assert.ok(hits[0].file.endsWith("signin.tsx"));
    assert.equal(hits[0].severity, "major");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("auth/brand-flood-panel does NOT fire on tinted neutral auth panel", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-brandclean-"));
  try {
    fs.writeFileSync(
      path.join(dir, "signin.tsx"),
      [
        `export function SignIn() {`,
        `  return (`,
        `    <div className="flex">`,
        `      <aside className="min-h-screen w-1/2 bg-neutral-100" />`,
        `      <form><input type="password" aria-label="Password" autoComplete="current-password" /></form>`,
        `    </div>`,
        `  );`,
        `}`,
        ``,
      ].join("\n"),
    );
    const result = await scan(dir);
    const hits = result.findings.filter((f) => f.rule === "auth/brand-flood-panel");
    assert.equal(hits.length, 0, "tinted neutral panel is the recommended pattern");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// marketing production tells — eyebrow flood, scroll cue, numbered eyebrows,
// duplicate CTA intent
// ---------------------------------------------------------------------------
test("copy/em-dash-flood counts entity-spelled em dashes", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-emdash-entity-"));
  try {
    // Same glyph, encoded. Without this the rule could be cleared by escaping.
    fs.writeFileSync(
      path.join(dir, "page.html"),
      `<p>one &mdash; two</p>\n<p>three &#8212; four</p>\n<p>five &mdash; six</p>\n`,
    );
    // Two is a deliberate pair, not a flood.
    fs.writeFileSync(
      path.join(dir, "restrained.html"),
      `<p>one &mdash; two</p>\n<p>three &mdash; four</p>\n`,
    );
    const result = await scan(dir);
    const hits = result.findings.filter((f) => f.rule === "copy/em-dash-flood");
    assert.equal(hits.length, 1, "only the flooded file is flagged");
    assert.ok(hits[0].file.endsWith("page.html"));
    assert.match(hits[0].snippet, /3 em dashes/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the demonstration guard reads the enclosing block's selector", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-slopblock-"));
  try {
    // The declaration sits several lines below the selector, which is how CSS is
    // normally written and where the single-line version of this guard failed.
    fs.writeFileSync(
      path.join(dir, "demo.css"),
      `.slop-demo-btn {\n  font-weight: 500;\n  color: white;\n  padding: 12px 24px;\n  background: linear-gradient(135deg, #a855f7, #22d3ee);\n}\n`,
    );
    fs.writeFileSync(
      path.join(dir, "real.css"),
      `.hero-btn {\n  font-weight: 500;\n  color: white;\n  background: linear-gradient(135deg, #a855f7, #22d3ee);\n}\n`,
    );
    const result = await scan(dir);
    const hits = result.findings.filter((f) => f.rule === "purple-cyan-gradient");
    assert.equal(hits.length, 1, "only the block that does not name itself a demo is flagged");
    assert.ok(hits[0].file.endsWith("real.css"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a CSS rule that names itself the bad example is a demonstration", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-slopdemo-"));
  try {
    // A page that argues against slop by rendering it must not be penalised for
    // rendering it. The selector is the signal.
    fs.writeFileSync(
      path.join(dir, "demo.css"),
      `.qhero[data-q="slop"] { background: linear-gradient(135deg, #a855f7, #22d3ee); }\n`,
    );
    // The same declaration on a normal selector is still the real thing.
    fs.writeFileSync(
      path.join(dir, "real.css"),
      `.hero { background: linear-gradient(135deg, #a855f7, #22d3ee); }\n`,
    );
    const result = await scan(dir);
    const hits = result.findings.filter((f) => f.rule === "purple-cyan-gradient");
    assert.equal(hits.length, 1, "only the non-demonstration selector is flagged");
    assert.ok(hits[0].file.endsWith("real.css"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("layout/image-height-from-attribute catches a width-only image rule", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-imgheight-"));
  try {
    // The defect: attributes supply the height, CSS supplies only the width, and
    // the image renders stretched. This is what `perf/image-no-dimensions` advice
    // produces if `height: auto` is left off.
    fs.writeFileSync(
      path.join(dir, "broken.html"),
      `<style>.shot img { width: 100%; aspect-ratio: 7 / 6; object-fit: cover; }</style>\n<div class="shot"><img src="a.webp" width="1100" height="1375" alt="a"></div>\n`,
    );
    // Sizing both axes is a deliberate crop, not the bug.
    fs.writeFileSync(
      path.join(dir, "fine.html"),
      `<style>.shot img { width: 100%; height: auto; aspect-ratio: 7 / 6; }</style>\n<div class="shot"><img src="a.webp" width="1100" height="1375" alt="a"></div>\n`,
    );
    // No height attribute anywhere: nothing for the hint to win with.
    fs.writeFileSync(
      path.join(dir, "noattr.html"),
      `<style>.shot img { width: 100%; aspect-ratio: 7 / 6; }</style>\n<div class="shot"><img src="a.webp" alt="a"></div>\n`,
    );

    const result = await scan(dir);
    const hits = result.findings.filter((f) => f.rule === "layout/image-height-from-attribute");
    assert.equal(hits.length, 1, "only the width-only rule is flagged");
    assert.ok(hits[0].file.endsWith("broken.html"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("type rules measure the ladder, not the palette", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-type-"));
  try {
    // Twelve steps, none of them separated: the shape every one of our own
    // scenes had before the ladder was measured against real surfaces.
    const crowded = [10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 46, 56]
      .map((n, i) => `.s${i} { font-size: ${n}px; }`).join("\n");
    fs.writeFileSync(path.join(dir, "crowded.css"), crowded + "\n");

    // Five steps with a 2.5x jump to display, and the display set medium.
    fs.writeFileSync(
      path.join(dir, "ladder.css"),
      `.a { font-size: 13px; }\n.b { font-size: 16px; }\n.c { font-size: 20px; }\n` +
      `.d { font-size: 30px; }\n.e { font-size: 76px; font-weight: 500; }\n`,
    );

    // Responsive restatements of steps that already exist are not new steps.
    fs.writeFileSync(
      path.join(dir, "responsive.css"),
      `.h { font-size: 76px; }\n.b { font-size: 16px; }\n.c { font-size: 30px; }\n` +
      `@media (max-width: 40rem) {\n  .h { font-size: 44px; }\n  .c { font-size: 24px; }\n}\n`,
    );

    // Bold display: the size is already the emphasis.
    fs.writeFileSync(
      path.join(dir, "bold.css"),
      `.a { font-size: 13px; }\n.b { font-size: 16px; }\n.c { font-size: 30px; }\n` +
      `.h1 { font-size: 76px; font-weight: 700; }\n`,
    );

    const result = await scan(dir);
    const of = (rule) => result.findings.filter((f) => f.rule === rule);

    const crowdedHits = of("type/crowded-ladder");
    assert.equal(crowdedHits.length, 1, "only the twelve-step file is crowded");
    assert.ok(crowdedHits[0].file.endsWith("crowded.css"));

    const gapHits = of("type/display-not-separated");
    assert.equal(gapHits.length, 1, "56px over 46px is not a display step");
    assert.ok(gapHits[0].file.endsWith("crowded.css"));

    const boldHits = of("type/bold-display");
    assert.equal(boldHits.length, 1);
    assert.ok(boldHits[0].file.endsWith("bold.css"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("css/duplicate-declaration catches a property set twice in one block", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-dupdecl-"));
  try {
    // The defect, exactly as it shipped: the pale on-field colour is declared
    // first, an older dark ink is declared last, and the last one wins — putting
    // near-black type on a coloured field at 1.6:1. Nothing else catches it,
    // because the rendered text sits over imagery and cannot be measured.
    fs.writeFileSync(
      path.join(dir, "broken.css"),
      `.wordmark {\n  color: var(--on-field);\n  font-size: 17px;\n  color: var(--ink);\n}\n`,
    );
    // A shorthand narrowed by a longhand is normal CSS, not a duplicate.
    fs.writeFileSync(
      path.join(dir, "narrowing.css"),
      `.card {\n  margin: 0;\n  margin-top: 4px;\n}\n`,
    );
    // The same value twice is redundant, not a silent override; and custom
    // properties are redeclared on purpose all the time.
    fs.writeFileSync(
      path.join(dir, "same.css"),
      `:root {\n  --plum: oklch(40% 0.13 300);\n  --plum: oklch(40% 0.13 300);\n}\n.b { color: red; color: red; }\n`,
    );

    const result = await scan(dir);
    const hits = result.findings.filter((f) => f.rule === "css/duplicate-declaration");
    assert.equal(hits.length, 1, "only the conflicting duplicate is flagged");
    assert.ok(hits[0].file.endsWith("broken.css"));
    assert.match(hits[0].snippet, /color twice/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("tables/no-overflow-handling reads a sticky header on an ARIA table", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-ariatable-"));
  try {
    const head = `<div class="t-head" role="row"><span role="columnheader">File</span></div>`;
    const row = `<div class="t-row" role="row"><span role="cell">Hero.tsx</span></div>`;
    // Grid table with both affordances, spelled the way an ARIA table has to
    // spell them: no <thead>, no <th>, sticky applied to the header row's class.
    fs.writeFileSync(
      path.join(dir, "compliant.html"),
      `<style>.wrap { overflow-x: auto; }\n.wrap .t-head { position: sticky; top: 0; }</style>\n<div class="wrap" role="table">${head}${row}</div>\n`,
    );
    // Tailwind spelling on the header row itself.
    fs.writeFileSync(
      path.join(dir, "tailwind.html"),
      `<div class="overflow-x-auto" role="table"><div class="sticky top-0" role="row"><span role="columnheader">File</span></div>${row}</div>\n`,
    );
    // Same markup with no sticky rule anywhere — the finding must survive.
    fs.writeFileSync(
      path.join(dir, "missing.html"),
      `<style>.wrap { overflow-x: auto; }</style>\n<div class="wrap" role="table">${head}${row}</div>\n`,
    );

    const result = await scan(dir);
    const hits = result.findings.filter((f) => f.rule === "tables/no-overflow-handling");
    assert.equal(hits.length, 1, "only the file with no sticky header is flagged");
    assert.ok(hits[0].file.endsWith("missing.html"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("layout/eyebrow-flood fires at 4+ uppercase-tracked labels, skips table headers", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-eyebrow-"));
  try {
    const label = `<p className="text-xs uppercase tracking-widest">LABEL</p>`;
    fs.writeFileSync(
      path.join(dir, "landing.tsx"),
      `export function Page() {\n  return <div>\n    ${label}\n    ${label}\n    ${label}\n    ${label}\n  </div>;\n}\n`,
    );
    // Three labels — a deliberate kicker system, must not fire.
    fs.writeFileSync(
      path.join(dir, "restrained.tsx"),
      `export function Page() {\n  return <div>\n    ${label}\n    ${label}\n    ${label}\n  </div>;\n}\n`,
    );
    // Table headers in caps are legitimate — must not count toward the flood.
    fs.writeFileSync(
      path.join(dir, "table.tsx"),
      `export function Table() {\n  return <thead>\n    <th className="uppercase tracking-wide">Name</th>\n    <th className="uppercase tracking-wide">Role</th>\n    <th className="uppercase tracking-wide">Status</th>\n    <th className="uppercase tracking-wide">Owner</th>\n    <th className="uppercase tracking-wide">Updated</th>\n  </thead>;\n}\n`,
    );
    const result = await scan(dir);
    const hits = result.findings.filter((f) => f.rule === "layout/eyebrow-flood");
    assert.equal(hits.length, 1, "fires only on the flooded landing file");
    assert.ok(hits[0].file.endsWith("landing.tsx"));
    assert.equal(hits[0].severity, "major");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("copy/em-dash-flood fires at 3+ em dashes in visible text, ignores comments and .ts files", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-emdash-"));
  try {
    fs.writeFileSync(
      path.join(dir, "flooded.tsx"),
      [
        `export function Page() {`,
        `  return (`,
        `    <div>`,
        `      <p>Fast — really fast — builds for every team</p>`,
        `      <p>Deploy in seconds — no config needed</p>`,
        `    </div>`,
        `  );`,
        `}`,
        ``,
      ].join("\n"),
    );
    // Two em dashes in copy + comments full of them — must not fire.
    fs.writeFileSync(
      path.join(dir, "restrained.tsx"),
      [
        `// notes — with — many — em — dashes — in — comments`,
        `export function Page() {`,
        `  return <p>One deliberate aside — that's fine — and done.</p>;`,
        `}`,
        ``,
      ].join("\n"),
    );
    // Plain .ts files never gate on this rule.
    fs.writeFileSync(
      path.join(dir, "constants.ts"),
      `export const NOTES = "a — b — c — d — e";\n`,
    );
    const result = await scan(dir);
    const hits = result.findings.filter((f) => f.rule === "copy/em-dash-flood");
    assert.equal(hits.length, 1, "fires only on the flooded tsx file");
    assert.ok(hits[0].file.endsWith("flooded.tsx"));
    assert.equal(hits[0].severity, "major");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("copy/scroll-cue fires on scroll cues, skips real labels", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-scrollcue-"));
  try {
    fs.writeFileSync(
      path.join(dir, "hero.tsx"),
      [
        `export function Hero() {`,
        `  return (`,
        `    <div>`,
        `      <span className="text-xs">Scroll to explore</span>`,
        `      <span>↓ scroll</span>`,
        `      <label>Scroll direction</label>`,
        `    </div>`,
        `  );`,
        `}`,
        ``,
      ].join("\n"),
    );
    const result = await scan(dir);
    const hits = result.findings.filter((f) => f.rule === "copy/scroll-cue");
    assert.equal(hits.length, 2, "both cues fire; 'Scroll direction' label does not");
    assert.equal(hits[0].severity, "major");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("copy/section-number-eyebrow fires on zero-padded counters, skips dates", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-secnum-"));
  try {
    fs.writeFileSync(
      path.join(dir, "sections.tsx"),
      [
        `export function Sections() {`,
        `  return (`,
        `    <div>`,
        `      <span className="text-xs">01 · About</span>`,
        `      <span>02 / Process</span>`,
        `      <time>01/02/2026</time>`,
        `      <span>10 projects</span>`,
        `    </div>`,
        `  );`,
        `}`,
        ``,
      ].join("\n"),
    );
    const result = await scan(dir);
    const hits = result.findings.filter((f) => f.rule === "copy/section-number-eyebrow");
    assert.equal(hits.length, 2, "both numbered eyebrows fire; date and count do not");
    assert.equal(hits[0].severity, "major");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("copy/section-number-eyebrow does NOT fire on hyphenated tokens or table cells", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-secnum-fp-"));
  try {
    fs.writeFileSync(
      path.join(dir, "table.tsx"),
      [
        `export function Invoices() {`,
        `  return (`,
        `    <table>`,
        `      <tbody>`,
        `        <tr>`,
        `          <td>03-Jan Invoice</td>`,
        `          <td>07-Eleven Corp</td>`,
        `          <td>01 · About</td>`,
        `        </tr>`,
        `      </tbody>`,
        `    </table>`,
        `  );`,
        `}`,
        ``,
      ].join("\n"),
    );
    const result = await scan(dir);
    const hits = result.findings.filter((f) => f.rule === "copy/section-number-eyebrow");
    assert.equal(
      hits.length,
      0,
      "hyphenated compound tokens (07-Eleven, 03-Jan) and table cells (even a padded eyebrow) must not fire",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("copy/duplicate-cta-intent fires on two labels of one intent, not on reuse of one label", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-ctaintent-"));
  try {
    fs.writeFileSync(
      path.join(dir, "duplicated.tsx"),
      [
        `export function Page() {`,
        `  return (`,
        `    <div>`,
        `      <a href="#contact">Get in touch</a>`,
        `      <button>Let's talk</button>`,
        `    </div>`,
        `  );`,
        `}`,
        ``,
      ].join("\n"),
    );
    // Same label reused (nav + hero) is the recommended pattern — must not fire.
    fs.writeFileSync(
      path.join(dir, "consistent.tsx"),
      [
        `export function Page() {`,
        `  return (`,
        `    <div>`,
        `      <a href="#contact">Get in touch</a>`,
        `      <button>Get in touch</button>`,
        `    </div>`,
        `  );`,
        `}`,
        ``,
      ].join("\n"),
    );
    const result = await scan(dir);
    const hits = result.findings.filter((f) => f.rule === "copy/duplicate-cta-intent");
    assert.equal(hits.length, 1, "fires only where two labels share one intent");
    assert.ok(hits[0].file.endsWith("duplicated.tsx"));
    assert.equal(hits[0].severity, "major");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 2.3 — CLI parity: ui-craft-detect --json output == scan() output (full)
// ---------------------------------------------------------------------------
test("CLI --json findings match scan() findings (parity)", async () => {
  // Run CLI
  let cliStdout;
  try {
    cliStdout = execFileSync(process.execPath, [DETECT_MJS, SLOP_FIXTURE, "--json"], {
      encoding: "utf8",
    });
  } catch (err) {
    // CLI exits with code 1 when there are errors — execFileSync throws, but stdout is still populated.
    cliStdout = err.stdout;
  }

  const cliResult = JSON.parse(cliStdout);
  const scanResult = await scan(SLOP_FIXTURE);

  // Compare version + summary envelope.
  assert.equal(cliResult.version, scanResult.version, "version must match between CLI and scan()");
  assert.deepStrictEqual(cliResult.summary, scanResult.summary, "summary must match between CLI and scan()");

  // Full deep comparison of findings (all fields: rule, line, severity, file,
  // description, snippet, fix) — sorted by rule+line for stability.
  const sortKey = (f) => `${f.rule}:${f.line}`;
  const cliFindings = [...cliResult.findings].sort((a, b) =>
    sortKey(a).localeCompare(sortKey(b))
  );
  const scanFindings = [...scanResult.findings].sort((a, b) =>
    sortKey(a).localeCompare(sortKey(b))
  );

  assert.deepStrictEqual(
    cliFindings,
    scanFindings,
    "CLI and scan() must return identical findings (all fields)"
  );
});

// ---------------------------------------------------------------------------
// 2.6 — CLI --sarif: produces valid SARIF JSON and correct exit code
// ---------------------------------------------------------------------------
test("CLI --sarif produces valid SARIF output and exits with code 1 on slop", () => {
  let sarifStdout;
  let exitCode = 0;
  try {
    sarifStdout = execFileSync(process.execPath, [DETECT_MJS, SLOP_FIXTURE, "--sarif"], {
      encoding: "utf8",
    });
  } catch (err) {
    // CLI exits 1 when there are error-severity findings — capture stdout anyway.
    sarifStdout = err.stdout;
    exitCode = err.status;
  }

  // Must be parseable JSON.
  let sarif;
  assert.doesNotThrow(() => {
    sarif = JSON.parse(sarifStdout);
  }, "SARIF output must be valid JSON");

  // Must have the SARIF 2.1.0 shape.
  assert.ok(Array.isArray(sarif.runs), "SARIF must have a runs array");
  assert.ok(sarif.runs.length > 0, "SARIF runs must be non-empty");
  assert.ok(Array.isArray(sarif.runs[0].results), "SARIF runs[0] must have a results array");
  assert.ok(sarif.runs[0].results.length > 0, "SARIF results must be non-empty for slop fixture");

  // Exit code must be 1 (slop fixture has critical findings).
  assert.equal(exitCode, 1, "CLI must exit with code 1 for slop fixture with --sarif");
});

// ---------------------------------------------------------------------------
// Extra: CLI exit codes intact
// ---------------------------------------------------------------------------
test("CLI exits with code 1 when findings contain errors (exit code parity)", () => {
  let exitCode = 0;
  try {
    execFileSync(process.execPath, [DETECT_MJS, SLOP_FIXTURE, "--json"], { encoding: "utf8" });
  } catch (err) {
    exitCode = err.status;
  }
  assert.equal(exitCode, 1, "CLI must exit with code 1 when there are critical findings");
});

test("CLI exits with code 0 for clean input", () => {
  let exitCode = 0;
  try {
    execFileSync(process.execPath, [DETECT_MJS, CLEAN_FIXTURE, "--json"], { encoding: "utf8" });
  } catch (err) {
    exitCode = err.status;
  }
  assert.equal(exitCode, 0, "CLI must exit with code 0 for clean input");
});

// ---------------------------------------------------------------------------
// Error path: nonexistent path returns structured result without crashing
// ---------------------------------------------------------------------------
test("scan() on nonexistent path returns structured error without throwing", async () => {
  const result = await scan("/nonexistent/path/that/does/not/exist.tsx");
  assert.ok(result.error, "result must have an error field");
  assert.equal(result.findings.length, 0, "findings must be empty on error");
  assert.equal(result.summary.files_scanned, 0, "files_scanned must be 0 on error");
  assert.equal(result.coverage.complete, false, "coverage must be incomplete on error");
  assert.equal(result.scan_errors[0].code, "path_unreadable");
});

test("scan() reports limit omissions and never labels an incomplete scan clean", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-limits-"));
  try {
    fs.writeFileSync(path.join(dir, "clean.tsx"), `export const Clean = () => <main />;\n`);
    const result = await scan(dir, { limits: { maxFileBytes: 4 } });
    assert.ok(result.error, "incomplete scan must expose an error");
    assert.equal(result.findings.length, 0);
    assert.equal(result.coverage.complete, false);
    assert.equal(result.summary.files_scanned, 0);
    assert.equal(result.summary.files_omitted, 1);
    assert.equal(result.scan_errors[0].code, "max_file_bytes_exceeded");
    assert.equal(result.scan_policy.mode, "fail-closed");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("scan() never follows symlinks discovered during directory traversal", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-symlink-"));
  try {
    fs.writeFileSync(path.join(dir, "target.tsx"), `export const Clean = () => <main />;\n`);
    fs.symlinkSync(path.join(dir, "target.tsx"), path.join(dir, "link.tsx"));
    const result = await scan(dir);
    assert.equal(result.coverage.complete, false);
    assert.equal(result.summary.files_scanned, 1);
    assert.ok(result.scan_errors.some((error) => error.code === "symlink_not_allowed"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readFileNoFollow enforces the byte ceiling while reading", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-bounded-read-"));
  const file = path.join(dir, "input.tsx");
  try {
    fs.writeFileSync(file, "12345678");
    assert.equal((await readFileNoFollow(file, 8)).toString(), "12345678");
    await assert.rejects(
      readFileNoFollow(file, 7),
      (error) => error.scanCode === "max_file_bytes_exceeded",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI --fix refuses to read or write through a symlink", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-fix-symlink-"));
  const target = path.join(dir, "target.css");
  const link = path.join(dir, "link.css");
  const original = ".card { transition: all 200ms ease; }\n";
  try {
    fs.writeFileSync(target, original);
    fs.symlinkSync(target, link);
    const result = runDetectCli([link, "--fix"]);
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /symlink/i);
    assert.equal(fs.readFileSync(target, "utf8"), original);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("secure fix write rejects inode replacement after the read snapshot", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-fix-inode-"));
  const file = path.join(dir, "input.css");
  try {
    fs.writeFileSync(file, "original");
    const snapshot = await readFileSnapshotNoFollow(file, 64);
    fs.writeFileSync(path.join(dir, "replacement.css"), "original");
    fs.renameSync(path.join(dir, "replacement.css"), file);
    await assert.rejects(
      writeFileNoFollow(file, "original", "fixed", {
        rootDir: dir,
        expectedIdentity: snapshot.identity,
        maxBytes: 64,
      }),
      (error) => error.scanCode === "file_changed_during_scan",
    );
    assert.equal(fs.readFileSync(file, "utf8"), "original");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("secure fix write failures keep the original and clean sibling temps", async () => {
  for (const failure of ["write", "rename"]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `detect-fix-${failure}-`));
    const file = path.join(dir, "input.css");
    try {
      fs.writeFileSync(file, "original", { mode: 0o640 });
      const snapshot = await readFileSnapshotNoFollow(file, 64);
      const operations = failure === "write"
        ? { writeTemp: async () => { throw new Error("simulated write failure"); } }
        : { rename: async () => { throw new Error("simulated rename failure"); } };
      await assert.rejects(
        writeFileNoFollow(file, "original", "fixed", {
          rootDir: dir,
          expectedIdentity: snapshot.identity,
          maxBytes: 64,
          operations,
        }),
        /simulated/,
      );
      assert.equal(fs.readFileSync(file, "utf8"), "original");
      assert.equal(
        fs.readdirSync(dir).some((name) => name.includes(".ui-craft-")),
        false,
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test("secure fix replacement preserves the original file mode", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-fix-mode-"));
  const file = path.join(dir, "input.css");
  try {
    fs.writeFileSync(file, "original", { mode: 0o640 });
    const snapshot = await readFileSnapshotNoFollow(file, 64);
    await writeFileNoFollow(file, "original", "fixed", {
      rootDir: dir,
      expectedIdentity: snapshot.identity,
      maxBytes: 64,
    });
    assert.equal(fs.readFileSync(file, "utf8"), "fixed");
    assert.equal(fs.statSync(file).mode & 0o777, 0o640);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI --fix does not count fixes when replacement creation fails", () => {
  if (process.platform === "win32") return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-fix-summary-"));
  const file = path.join(dir, "input.css");
  const original = ".card { transition: all 200ms ease; }\n";
  try {
    fs.writeFileSync(file, original);
    fs.chmodSync(dir, 0o555);
    const result = runDetectCli([file, "--fix"]);
    assert.equal(result.exitCode, 2);
    assert.match(result.stdout, /Auto-fixed: 0/);
    assert.equal(fs.readFileSync(file, "utf8"), original);
  } finally {
    fs.chmodSync(dir, 0o755);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("secure fix rejects root and parent path swaps without writing outside", async () => {
  if (process.platform === "win32") return;
  for (const swapped of ["root", "parent"]) {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), `detect-boundary-${swapped}-`));
    const root = path.join(base, "root");
    const parent = path.join(root, "parent");
    const outsideRoot = path.join(base, "outside");
    const outsideParent = path.join(outsideRoot, "parent");
    fs.mkdirSync(parent, { recursive: true });
    fs.mkdirSync(outsideParent, { recursive: true });
    const file = path.join(parent, "input.css");
    const outsideFile = path.join(outsideParent, "input.css");
    fs.writeFileSync(file, "original");
    fs.writeFileSync(outsideFile, "outside");
    try {
      const snapshot = await readFileSnapshotNoFollow(file, 64);
      await assert.rejects(
        writeFileNoFollow(file, "original", "fixed", {
          rootDir: root,
          expectedIdentity: snapshot.identity,
          maxBytes: 64,
          operations: {
            afterTempSync: async () => {
              if (swapped === "root") {
                fs.renameSync(root, path.join(base, "moved-root"));
                fs.symlinkSync(outsideRoot, root);
              } else {
                fs.renameSync(parent, path.join(root, "moved-parent"));
                fs.symlinkSync(outsideParent, parent);
              }
            },
          },
        }),
        (error) => error.scanCode === "fix_boundary_changed",
      );
      assert.equal(fs.readFileSync(outsideFile, "utf8"), "outside");
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  }
});

// ---------------------------------------------------------------------------
// Diff-scoped scanning — Phase 1/2 (PR 1 of detect-ci-integration)
// Pure parser/filter unit tests. String-fixture based (no temp repos) so
// they're git-version independent. See design obs #869.
// ---------------------------------------------------------------------------

// --- parseUnifiedDiff -------------------------------------------------------

test("parseUnifiedDiff: single hunk in one file", () => {
  const diff = `diff --git a/src/foo.tsx b/src/foo.tsx
index 1111111..2222222 100644
--- a/src/foo.tsx
+++ b/src/foo.tsx
@@ -10,0 +11,3 @@ function Foo() {
+  const a = 1;
+  const b = 2;
+  const c = 3;
`;
  const hunks = parseUnifiedDiff(diff);
  assert.deepStrictEqual(hunks.get("src/foo.tsx"), [[11, 13]]);
});

test("parseUnifiedDiff: multiple hunks in one file", () => {
  const diff = `diff --git a/src/foo.tsx b/src/foo.tsx
--- a/src/foo.tsx
+++ b/src/foo.tsx
@@ -5,0 +5,2 @@
+  const x = 1;
+  const y = 2;
@@ -40,0 +42,1 @@
+  const z = 3;
`;
  const hunks = parseUnifiedDiff(diff);
  assert.deepStrictEqual(hunks.get("src/foo.tsx"), [
    [5, 6],
    [42, 42],
  ]);
});

test("parseUnifiedDiff: renamed file with edits is followed, not double-counted", () => {
  const diff = `diff --git a/src/old-name.tsx b/src/new-name.tsx
similarity index 90%
rename from src/old-name.tsx
rename to src/new-name.tsx
index 1111111..2222222 100644
--- a/src/old-name.tsx
+++ b/src/new-name.tsx
@@ -3,0 +3,1 @@
+  const renamed = true;
`;
  const hunks = parseUnifiedDiff(diff);
  assert.ok(!hunks.has("src/old-name.tsx"), "old path must not appear (no delete+add double count)");
  assert.deepStrictEqual(hunks.get("src/new-name.tsx"), [[3, 3]]);
});

test("parseUnifiedDiff: pure rename (no edits) yields empty ranges for new path", () => {
  const diff = `diff --git a/src/old-name.tsx b/src/new-name.tsx
similarity index 100%
rename from src/old-name.tsx
rename to src/new-name.tsx
`;
  const hunks = parseUnifiedDiff(diff);
  assert.ok(hunks.has("src/new-name.tsx"), "renamed file must be listed (visible in files scope)");
  assert.deepStrictEqual(hunks.get("src/new-name.tsx"), [], "no ranges (invisible in changed scope)");
});

test("parseUnifiedDiff: newly-added file — all lines counted as changed", () => {
  const diff = `diff --git a/src/brand-new.tsx b/src/brand-new.tsx
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/brand-new.tsx
@@ -0,0 +1,5 @@
+export function BrandNew() {
+  return <div>new</div>;
+}
+
+export default BrandNew;
`;
  const hunks = parseUnifiedDiff(diff);
  assert.deepStrictEqual(hunks.get("src/brand-new.tsx"), [[1, 5]]);
});

test("parseUnifiedDiff: binary file is skipped cleanly, no crash", () => {
  const diff = `diff --git a/assets/logo.png b/assets/logo.png
index 1111111..2222222 100644
Binary files a/assets/logo.png and b/assets/logo.png differ
`;
  assert.doesNotThrow(() => parseUnifiedDiff(diff));
  const hunks = parseUnifiedDiff(diff);
  assert.ok(hunks.has("assets/logo.png"), "binary file must be listed (files scope)");
  assert.deepStrictEqual(hunks.get("assets/logo.png"), [], "no ranges fabricated for binary file");
});

test("parseUnifiedDiff: pure-deletion hunk (+c,0) is skipped, no range added", () => {
  const diff = `diff --git a/src/foo.tsx b/src/foo.tsx
--- a/src/foo.tsx
+++ b/src/foo.tsx
@@ -10,3 +10,0 @@
-  const removed1 = 1;
-  const removed2 = 2;
-  const removed3 = 3;
`;
  const hunks = parseUnifiedDiff(diff);
  assert.deepStrictEqual(hunks.get("src/foo.tsx"), []);
});

test("parseUnifiedDiff: multiple files in one diff are each tracked independently", () => {
  const diff = `diff --git a/src/a.tsx b/src/a.tsx
--- a/src/a.tsx
+++ b/src/a.tsx
@@ -1,0 +1,2 @@
+line1
+line2
diff --git a/src/b.tsx b/src/b.tsx
--- a/src/b.tsx
+++ b/src/b.tsx
@@ -8,0 +9,1 @@
+line9
`;
  const hunks = parseUnifiedDiff(diff);
  assert.deepStrictEqual(hunks.get("src/a.tsx"), [[1, 2]]);
  assert.deepStrictEqual(hunks.get("src/b.tsx"), [[9, 9]]);
});

// --- filterFindingsByScope ---------------------------------------------------

const SCOPE_FIXTURE_FINDINGS = [
  { file: "src/touched.tsx", line: 12, rule: "in-hunk", severity: "critical" },
  { file: "src/touched.tsx", line: 99, rule: "out-of-hunk-same-file", severity: "warn" },
  { file: "src/untouched.tsx", line: 5, rule: "untouched-file", severity: "major" },
];

function fixtureHunks() {
  return new Map([["src/touched.tsx", [[10, 15]]]]);
}

test("filterFindingsByScope: 'full' returns the same array reference (identity)", () => {
  const findings = SCOPE_FIXTURE_FINDINGS;
  const result = filterFindingsByScope(findings, "full", fixtureHunks(), { cwd: "/repo", repoToplevel: "/repo" });
  assert.strictEqual(result, findings, "full scope must return the identical array reference");
});

test("filterFindingsByScope: 'files' keeps whole-file findings, drops untouched files", () => {
  const result = filterFindingsByScope(SCOPE_FIXTURE_FINDINGS, "files", fixtureHunks(), {
    cwd: "/repo",
    repoToplevel: "/repo",
  });
  const rules = result.map((f) => f.rule).sort();
  assert.deepStrictEqual(rules, ["in-hunk", "out-of-hunk-same-file"]);
});

test("filterFindingsByScope: 'changed' excludes findings outside hunks, keeps in-hunk findings", () => {
  const result = filterFindingsByScope(SCOPE_FIXTURE_FINDINGS, "changed", fixtureHunks(), {
    cwd: "/repo",
    repoToplevel: "/repo",
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].rule, "in-hunk");
});

test("filterFindingsByScope: normalizes cwd-relative paths for a subdirectory scan target", () => {
  // Simulates scanning from a subdirectory: scan()'s finding.file is relative
  // to process.cwd() (e.g. "touched.tsx" when cwd is "/repo/src"), while the
  // hunk map keys are always repo-relative ("src/touched.tsx"). The filter
  // must reconcile the two via repoToplevel.
  const subdirFindings = [
    { file: "touched.tsx", line: 12, rule: "in-hunk", severity: "critical" },
  ];
  const result = filterFindingsByScope(subdirFindings, "changed", fixtureHunks(), {
    cwd: "/repo/src",
    repoToplevel: "/repo",
  });
  assert.equal(result.length, 1, "finding must be matched after repo-relative normalization");
  assert.equal(result[0].rule, "in-hunk");
});

// --- resolveBaseRef ----------------------------------------------------------

test("resolveBaseRef: explicit base is verified and returned unchanged on success", () => {
  // HEAD always resolves inside this repo's working tree.
  const result = resolveBaseRef("HEAD", { cwd: __dirname });
  assert.equal(result, "HEAD");
});

test("resolveBaseRef: explicit base returns null when it cannot be verified (fallback trigger)", () => {
  const result = resolveBaseRef("this-ref-does-not-exist-anywhere-xyz", { cwd: __dirname });
  assert.equal(result, null);
});

test("resolveBaseRef: default resolution returns null outside a git work tree", () => {
  // /tmp is not (reliably) inside a git work tree; assert the non-git-repo
  // fallback path resolves to null without throwing.
  const result = resolveBaseRef(null, { cwd: "/tmp" });
  assert.doesNotThrow(() => resolveBaseRef(null, { cwd: "/tmp" }));
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// Diff-scoped scanning — Phase 3/4 (PR 2 of detect-ci-integration)
// CLI wiring integration tests: --scope, --base, --fail-on, end-to-end via a
// real ephemeral git repo, plus the non-git fallback path. See design obs #869.
// ---------------------------------------------------------------------------

/**
 * Runs the CLI via execFileSync and returns { stdout, stderr, exitCode },
 * regardless of whether the process exited non-zero (execFileSync throws in
 * that case — this normalizes both paths into one shape for assertions).
 * @param {string[]} args
 * @param {{cwd?: string}} [opts]
 */
function runCli(args, opts = {}) {
  try {
    const stdout = execFileSync(process.execPath, [DETECT_MJS, ...args], {
      encoding: "utf8",
      ...opts,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err) {
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", exitCode: err.status };
  }
}

/**
 * Builds a throwaway git repo in a fresh temp dir with a "main" branch
 * commit, then a second commit on top that both modifies an existing file
 * (adding a slop pattern in a fresh hunk) and touches an untouched-relative
 * file with a pre-existing (out-of-scope) slop pattern already committed on
 * main. Returns { dir, baseSha }.
 */
function buildScopeFixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-craft-detect-scope-"));
  const git = (args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });

  git(["init", "-q", "-b", "main"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "Test"]);

  // Base commit: one file with a pre-existing slop pattern (out-of-scope for
  // any diff against this base — it's already on main untouched by HEAD).
  fs.writeFileSync(
    path.join(dir, "preexisting.tsx"),
    `export function Old() {\n  return <div className="uppercase transition-all">OLD</div>;\n}\n`,
  );
  git(["add", "."]);
  git(["commit", "-q", "-m", "base"]);
  const baseSha = git(["rev-parse", "HEAD"]).trim();

  // HEAD commit: a brand-new file containing a slop pattern — this is the
  // only in-scope change vs baseSha.
  fs.writeFileSync(
    path.join(dir, "changed.tsx"),
    `export function New() {\n  return <div className="bg-gradient-to-r from-purple-500 to-cyan-500">NEW</div>;\n}\n`,
  );
  git(["add", "."]);
  git(["commit", "-q", "-m", "add changed file with slop"]);

  return { dir, baseSha };
}

test("integration: --scope changed reports only findings in the new file, not the pre-existing one", () => {
  const { dir, baseSha } = buildScopeFixtureRepo();
  try {
    const { stdout } = runCli([".", "--scope", "changed", "--base", baseSha, "--json"], { cwd: dir });
    const result = JSON.parse(stdout);
    const files = result.findings.map((f) => f.file);
    assert.ok(files.some((f) => f.includes("changed.tsx")), "must report finding in the new/changed file");
    assert.ok(
      !files.some((f) => f.includes("preexisting.tsx")),
      "must NOT report finding in the untouched pre-existing file",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: --scope files vs --scope changed both exclude the untouched file", () => {
  const { dir, baseSha } = buildScopeFixtureRepo();
  try {
    for (const scope of ["files", "changed"]) {
      const { stdout } = runCli([".", "--scope", scope, "--base", baseSha, "--json"], { cwd: dir });
      const result = JSON.parse(stdout);
      const files = result.findings.map((f) => f.file);
      assert.ok(
        !files.some((f) => f.includes("preexisting.tsx")),
        `--scope ${scope} must exclude untouched file`,
      );
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: --scope full (default) matches no-scope output (parity, byte-identical)", () => {
  const { dir, baseSha } = buildScopeFixtureRepo();
  try {
    const withFlag = runCli([".", "--scope", "full", "--base", baseSha, "--json"], { cwd: dir });
    const withoutFlag = runCli([".", "--json"], { cwd: dir });
    assert.deepStrictEqual(JSON.parse(withFlag.stdout), JSON.parse(withoutFlag.stdout));
    assert.equal(withFlag.exitCode, withoutFlag.exitCode, "exit codes must match too");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: non-git directory falls back to full scan with a stderr note, no crash", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-craft-detect-nogit-"));
  try {
    fs.writeFileSync(path.join(dir, "slop.tsx"), fs.readFileSync(SLOP_FIXTURE, "utf8"));
    const { stdout, stderr, exitCode } = runCli([".", "--scope", "changed", "--json"], { cwd: dir });
    const result = JSON.parse(stdout);
    assert.ok(result.findings.length > 0, "fallback must run a full scan (slop fixture has findings)");
    assert.equal(exitCode, 1, "fail-on default 'error' still applies to the unfiltered fallback set");
    assert.ok(stderr.includes("falling back to full scan"), "must emit fallback note on stderr");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: --fail-on exit-code matrix over scope-filtered findings", () => {
  const { dir, baseSha } = buildScopeFixtureRepo();
  try {
    // --fail-on none: always exits 0, even though the in-scope file has a
    // critical finding.
    let result = runCli(
      [".", "--scope", "changed", "--base", baseSha, "--fail-on", "none", "--json"],
      { cwd: dir },
    );
    assert.equal(result.exitCode, 0, "--fail-on none must always exit 0");

    // --fail-on error with the critical finding in scope: exits 1.
    result = runCli(
      [".", "--scope", "changed", "--base", baseSha, "--fail-on", "error", "--json"],
      { cwd: dir },
    );
    assert.equal(result.exitCode, 1, "--fail-on error must exit 1 when an in-scope critical finding exists");

    // --fail-on error, but the critical finding is entirely OUT of scope
    // (scope=changed against a base where nothing changed): exits 0.
    result = runCli(
      [".", "--scope", "changed", "--base", "HEAD", "--fail-on", "error", "--json"],
      { cwd: dir },
    );
    assert.equal(
      result.exitCode,
      0,
      "--fail-on error must exit 0 when the critical finding is filtered out by scope (base=HEAD, no diff)",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: --sarif output reflects scope-filtered results, not raw findings", () => {
  const { dir, baseSha } = buildScopeFixtureRepo();
  try {
    const { stdout } = runCli([".", "--scope", "changed", "--base", baseSha, "--sarif"], { cwd: dir });
    const sarif = JSON.parse(stdout);
    const uris = sarif.runs[0].results.map((r) => r.locations[0].physicalLocation.artifactLocation.uri);
    assert.ok(uris.some((u) => u.includes("changed.tsx")), "SARIF must include the in-scope finding");
    assert.ok(!uris.some((u) => u.includes("preexisting.tsx")), "SARIF must exclude the out-of-scope finding");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: --fail-on error with --scope files and errors outside touched files exits 0 (JSON still emitted)", () => {
  const { dir } = buildScopeFixtureRepo();
  try {
    // Diff against HEAD (nothing changed) to isolate the "errors exist, but
    // outside scope" case with --scope files.
    const { stdout, exitCode } = runCli(
      [".", "--scope", "files", "--base", "HEAD", "--fail-on", "error", "--json"],
      { cwd: dir },
    );
    const result = JSON.parse(stdout);
    assert.ok(result.findings, "JSON output must still be emitted");
    assert.equal(exitCode, 0, "exit code must be 0 — no in-scope errors when base=HEAD (no diff)");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: deleted file vs base — no crash, no fabricated findings", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-craft-detect-deleted-"));
  const git = (args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  try {
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "Test"]);

    fs.writeFileSync(
      path.join(dir, "to-delete.tsx"),
      `export function Gone() {\n  return <div className="uppercase">GONE</div>;\n}\n`,
    );
    git(["add", "."]);
    git(["commit", "-q", "-m", "base"]);
    const baseSha = git(["rev-parse", "HEAD"]).trim();

    fs.rmSync(path.join(dir, "to-delete.tsx"));
    git(["add", "."]);
    git(["commit", "-q", "-m", "delete file"]);

    let stdout;
    assert.doesNotThrow(() => {
      stdout = runCli(
        [".", "--scope", "changed", "--base", baseSha, "--json", "--fail-on", "none"],
        { cwd: dir },
      ).stdout;
    });
    const result = JSON.parse(stdout);
    assert.ok(
      !result.findings.some((f) => f.file.includes("to-delete.tsx")),
      "deleted file must not appear in findings",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Slice B — renderGHAWorkflow(config): pure function, no gh/network calls.
// gh api / gh pr comment invocations inside the generated bash step are
// intentionally NOT unit-tested here — untestable without a live PR. See
// the manual smoke-test checklist in tasks (Phase B2.4).
// ---------------------------------------------------------------------------

test("renderGHAWorkflow: default config interpolates scope/fail-on flags", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  assert.ok(
    yaml.includes(`--scope ${DEFAULT_GHA_CONFIG.scope} --fail-on ${DEFAULT_GHA_CONFIG.failOn}`),
    "pull_request scan step must use configured scope/fail-on",
  );
  assert.ok(
    yaml.includes("--scope full --fail-on error"),
    "push scan step must always use --scope full regardless of config.scope",
  );
});

test("renderGHAWorkflow: includes pull-requests: write permission with justification", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  assert.ok(yaml.includes("pull-requests: write"), "must declare pull-requests: write");
  assert.ok(
    /needed to post\/update the sticky PR summary comment/.test(yaml),
    "pull-requests: write must carry a one-line justification comment",
  );
  assert.ok(!/write-all/.test(yaml), "must not grant broader permissions than required");
});

test("renderGHAWorkflow: includes config and version marker lines", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  assert.ok(yaml.includes("# ui-craft-detect-config:"), "must emit config marker line");
  assert.ok(yaml.includes("# ui-craft-detect-version:"), "must emit version marker line");
});

test("renderGHAWorkflow: config marker JSON round-trips via JSON.parse exactly", () => {
  const config = { scope: "changed", failOn: "warning", comment: true, inlineComments: true, status: true };
  const yaml = renderGHAWorkflow(config);

  const markerLine = yaml
    .split("\n")
    .find((line) => line.startsWith("# ui-craft-detect-config:"));
  assert.ok(markerLine, "config marker line must be present");

  const jsonText = markerLine.slice("# ui-craft-detect-config:".length).trim();
  const parsed = JSON.parse(jsonText);
  assert.deepEqual(parsed, config, "parsed marker JSON must exactly match the input config");
});

test("renderGHAWorkflow: includes the sticky-comment step gated on pull_request", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  assert.ok(
    yaml.includes("Post or update sticky PR summary comment"),
    "must include the sticky-comment step",
  );
  assert.ok(yaml.includes("<!-- ui-craft-detect -->"), "must embed the hidden marker string");
  assert.ok(
    yaml.includes("github.event_name == 'pull_request'"),
    "sticky-comment step must be gated on pull_request events",
  );
});

test("renderGHAWorkflow: sticky-comment step runs one --markdown scan and dual-appends to BODY_FILE and GITHUB_STEP_SUMMARY", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);
  const stepStart = yaml.indexOf("Post or update sticky PR summary comment");
  const stepEnd = yaml.indexOf("COMMENT_ID=", stepStart);
  const stepSlice = yaml.slice(stepStart, stepEnd);

  assert.ok(stepSlice.includes("--markdown"), "must invoke the scan with --markdown");
  assert.ok(
    stepSlice.includes('cat "$MD_FILE" >> "$BODY_FILE"'),
    "must append the markdown temp file into BODY_FILE",
  );
  assert.ok(
    stepSlice.includes('cat "$MD_FILE" >> "$GITHUB_STEP_SUMMARY"'),
    "must append the markdown temp file into GITHUB_STEP_SUMMARY",
  );
  assert.ok(
    !stepSlice.includes('--fail-on none >> "$BODY_FILE"'),
    "must not contain the old plain-output-appended-directly-to-BODY_FILE line",
  );
  const scanInvocations = stepSlice.split("ui-craft-detect@latest").length - 1;
  assert.equal(scanInvocations, 1, "sticky-comment step must invoke the scan exactly once (single-scan invariant)");
});

test("renderGHAWorkflow: comment=false omits the sticky-comment step", () => {
  const yaml = renderGHAWorkflow({ ...DEFAULT_GHA_CONFIG, comment: false });

  assert.ok(
    !yaml.includes("Post or update sticky PR summary comment"),
    "sticky-comment step must be omitted when comment is false",
  );
  // Config marker still reflects the requested (comment:false) config exactly.
  assert.ok(yaml.includes('"comment":false'), "config marker must reflect comment:false");
});

test("renderGHAWorkflow: output has no tab characters and consistent top-level key ordering", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  assert.ok(!yaml.includes("\t"), "generated YAML must not contain tab characters");

  const topLevelKeys = yaml
    .split("\n")
    .filter((line) => /^[a-zA-Z_-]+:/.test(line))
    .map((line) => line.split(":")[0]);
  const nameIdx = topLevelKeys.indexOf("name");
  const onIdx = topLevelKeys.indexOf("on");
  const permissionsIdx = topLevelKeys.indexOf("permissions");
  const jobsIdx = topLevelKeys.indexOf("jobs");
  assert.ok(
    nameIdx < onIdx && onIdx < permissionsIdx && permissionsIdx < jobsIdx,
    "top-level keys must appear in a consistent order: name, on, permissions, jobs",
  );
});

// ---------------------------------------------------------------------------
// Slice C1 — commit-status step: pure-function assertions on renderGHAWorkflow
// output only. The actual `gh api .../statuses/{sha}` invocation is NOT
// unit-tested — untestable without a live push event. See the manual
// smoke-test checklist in tasks (Phase C1.5).
// ---------------------------------------------------------------------------

test("renderGHAWorkflow: status=true includes the commit-status step gated on non-pull_request", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  assert.ok(yaml.includes("Publish commit status"), "must include the commit-status step");
  assert.ok(
    yaml.includes("statuses/${{ github.sha }}"),
    "must POST to the statuses endpoint for the current commit SHA",
  );
  assert.ok(
    yaml.includes('context="ui-craft-detect"'),
    "must use the resolved context string ui-craft-detect",
  );
  assert.ok(
    yaml.includes(
      "target_url=\"${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}\"",
    ),
    "must use the resolved target_url string",
  );
});

test("renderGHAWorkflow: commit-status step is gated on github.event_name != 'pull_request' and continue-on-error", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);
  const stepIdx = yaml.indexOf("Publish commit status");
  assert.ok(stepIdx !== -1, "commit-status step must be present");
  const stepBlock = yaml.slice(stepIdx, stepIdx + 400);

  assert.ok(
    stepBlock.includes("if: always() && github.event_name != 'pull_request'"),
    "commit-status step must be gated on non-pull_request events and run even if the scan step failed (always())",
  );
  assert.ok(
    stepBlock.includes("continue-on-error: true"),
    "commit-status step must not block the authoritative fail-on gate",
  );
});

test("renderGHAWorkflow: commit-status step reuses the push-scan JSON output, no dedicated scan invocation of its own", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  const stepIdx = yaml.indexOf("Publish commit status");
  assert.ok(stepIdx !== -1, "commit-status step must be present");
  const stepBlock = yaml.slice(stepIdx, stepIdx + 400);

  assert.ok(
    !stepBlock.includes("npx --yes ui-craft-detect@latest"),
    "commit-status step must not invoke the scan CLI itself — it reads the push-scan step's JSON output",
  );
  assert.ok(
    stepBlock.includes("SCAN_JSON_FILE"),
    "commit-status step must read the push-scan step's captured JSON output",
  );
});

test("renderGHAWorkflow: includes statuses: write permission with justification when status is enabled", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  assert.ok(yaml.includes("statuses: write"), "must declare statuses: write");
  assert.ok(
    /needed to publish the ui-craft-detect commit status/.test(yaml),
    "statuses: write must carry a one-line justification comment",
  );
});

test("renderGHAWorkflow: status=false omits the commit-status step and the statuses: write permission", () => {
  const yaml = renderGHAWorkflow({ ...DEFAULT_GHA_CONFIG, status: false });

  assert.ok(
    !yaml.includes("Publish commit status"),
    "commit-status step must be omitted when status is false",
  );
  assert.ok(
    !yaml.includes("statuses: write"),
    "statuses: write permission must be omitted when status is false",
  );
  // Config marker still reflects the requested (status:false) config exactly.
  assert.ok(yaml.includes('"status":false'), "config marker must reflect status:false");
});

// ---------------------------------------------------------------------------
// Slice C2 — renderReviewComments(findings, commitSha): pure function, no
// gh/network calls. Callers MUST feed already scope-filtered ("changed")
// findings — this function trusts its input and does not re-filter by hunk
// ranges. The actual `gh api .../reviews --input` invocation inside the
// generated bash step is NOT unit-tested — untestable without a live PR.
// ---------------------------------------------------------------------------

test("renderReviewComments: builds a single review with one comment per finding", () => {
  const findings = [
    { file: "src/a.tsx", line: 5, description: "transition: all", fix: "list specific properties" },
    { file: "src/b.tsx", line: 12, description: "ALL CAPS heading", fix: "use sentence case" },
  ];
  const review = renderReviewComments(findings, "abc123");

  assert.equal(review.commit_id, "abc123");
  assert.equal(review.event, "COMMENT");
  assert.equal(review.comments.length, 2);
});

test("renderReviewComments: each comment has path, line, side RIGHT, and a body derived from description+fix", () => {
  const findings = [
    { file: "src/a.tsx", line: 5, description: "transition: all", fix: "list specific properties" },
  ];
  const review = renderReviewComments(findings, "abc123");
  const [comment] = review.comments;

  assert.equal(comment.path, "src/a.tsx");
  assert.equal(comment.line, 5);
  assert.equal(comment.side, "RIGHT");
  assert.ok(comment.body.includes("transition: all"), "body must include the finding description");
  assert.ok(comment.body.includes("list specific properties"), "body must include the fix suggestion");
  assert.ok(!("position" in comment), "must not include the deprecated position field");
});

test("renderReviewComments: side is always RIGHT regardless of input order/count", () => {
  const findings = [
    { file: "a.tsx", line: 1, description: "d1", fix: "f1" },
    { file: "b.tsx", line: 2, description: "d2", fix: "f2" },
    { file: "a.tsx", line: 9, description: "d3", fix: "f3" },
  ];
  const review = renderReviewComments(findings, "sha");
  assert.ok(review.comments.every((c) => c.side === "RIGHT"), "every comment must have side: RIGHT");
});

test("renderReviewComments: multiple findings across multiple files all land in one review's comments array", () => {
  const findings = [
    { file: "a.tsx", line: 1, description: "d1", fix: "f1" },
    { file: "b.tsx", line: 2, description: "d2", fix: "f2" },
    { file: "a.tsx", line: 9, description: "d3", fix: "f3" },
  ];
  const review = renderReviewComments(findings, "sha");
  const files = review.comments.map((c) => c.path);
  assert.deepEqual(files, ["a.tsx", "b.tsx", "a.tsx"]);
  assert.equal(review.comments.length, 3, "one review, three comments — not three separate reviews");
});

test("renderReviewComments: empty findings array returns null (guard against pointless empty review)", () => {
  assert.equal(renderReviewComments([], "sha"), null);
});

test("renderReviewComments: does not filter by hunk ranges itself — trusts already-scoped input", () => {
  // A finding that would be "out of scope" for a real diff still produces a
  // comment here, because renderReviewComments is a pure payload builder,
  // not a scope filter. The CLI wiring (--scope changed -> filterFindingsByScope
  // -> renderReviewComments) is what guarantees only diff-visible findings
  // are ever passed in; this test documents that renderReviewComments does
  // not re-derive that guarantee on its own.
  const findings = [{ file: "untouched.tsx", line: 999, description: "d", fix: "f" }];
  const review = renderReviewComments(findings, "sha");
  assert.equal(review.comments.length, 1);
});

// ---------------------------------------------------------------------------
// detect-ci-rich-output — renderMarkdownReport(findings, summary): pure
// function, no I/O/network. Mirrors renderReviewComments's test shape:
// inline fixtures, assert on returned string only.
// ---------------------------------------------------------------------------

test("renderMarkdownReport: valid findings render table, both accordions, branded header, and fix text", () => {
  const findings = [
    { rule: "transition-all", severity: "critical", file: "src/a.tsx", line: 5, fix: "list specific properties" },
    { rule: "all-caps-heading", severity: "warn", file: "src/b.tsx", line: 12, fix: "use sentence case" },
  ];
  const summary = { files_scanned: 10, files_flagged: 2, errors: 1, warnings: 1 };
  const out = renderMarkdownReport(findings, summary);

  assert.ok(out.includes("| rule | file:line | severity | fix |"), "must include table header");
  assert.ok(out.includes("<details open>"), "must include the always-open errors accordion");
  assert.ok(out.includes("<details>"), "must include the collapsed warnings accordion");
  assert.ok(
    out.includes('<img src="https://raw.githubusercontent.com/educlopez/ui-craft/main/assets/icon.svg" width="40">'),
    "must include the branded header image tag",
  );
  assert.ok(out.includes("list specific properties"), "must include fix text for errors");
  assert.ok(out.includes("use sentence case"), "must include fix text for warnings");
});

test("renderMarkdownReport: summary line reflects files scanned, total findings, and errors/warnings breakdown", () => {
  const findings = [
    { rule: "r1", severity: "critical", file: "a.tsx", line: 1, fix: "f1" },
    { rule: "r2", severity: "critical", file: "b.tsx", line: 2, fix: "f2" },
    { rule: "r3", severity: "warn", file: "c.tsx", line: 3, fix: "f3" },
    { rule: "r4", severity: "major", file: "d.tsx", line: 4, fix: "f4" },
    { rule: "r5", severity: "warn", file: "e.tsx", line: 5, fix: "f5" },
  ];
  const summary = { files_scanned: 10, files_flagged: 5, errors: 2, warnings: 3 };
  const out = renderMarkdownReport(findings, summary);

  assert.ok(out.includes("10 files scanned"), "must report files scanned");
  assert.ok(out.includes("5 findings"), "must report total findings count");
  assert.ok(out.includes("2 errors"), "must report errors count");
  assert.ok(out.includes("3 warnings"), "must report warnings count");
});

test("renderMarkdownReport: errors accordion is always <details open>, even with exactly one error", () => {
  const findings = [{ rule: "r1", severity: "critical", file: "a.tsx", line: 1, fix: "f1" }];
  const summary = { files_scanned: 1, files_flagged: 1, errors: 1, warnings: 0 };
  const out = renderMarkdownReport(findings, summary);

  const errorsSection = out.slice(out.indexOf("1 errors"));
  assert.ok(errorsSection.startsWith("1 errors</summary>") || out.includes("<details open>\n<summary>1 errors"));
  assert.ok(out.includes("<details open>"), "errors section must use <details open>");
});

test("renderMarkdownReport: warnings accordion is always collapsed (<details> without open), even with many warnings", () => {
  const findings = Array.from({ length: 50 }, (_, i) => ({
    rule: "r",
    severity: "warn",
    file: `f${i}.tsx`,
    line: i,
    fix: "fix",
  }));
  const summary = { files_scanned: 50, files_flagged: 50, errors: 0, warnings: 50 };
  const out = renderMarkdownReport(findings, summary);

  assert.ok(!out.includes("<details open>"), "warnings-only report must not contain any open accordion");
  assert.ok(out.includes("<details>\n<summary>50 warnings"), "warnings accordion must be collapsed");
});

test("renderMarkdownReport: empty findings array renders the positive state, not null/empty", () => {
  const summary = { files_scanned: 5, files_flagged: 0, errors: 0, warnings: 0 };
  const out = renderMarkdownReport([], summary);

  assert.ok(out.includes("✅ No issues found"), "must render the positive no-issues state");
  assert.ok(out.length > 0, "must not return an empty string");
  assert.ok(
    out.includes('<img src="https://raw.githubusercontent.com/educlopez/ui-craft/main/assets/icon.svg"'),
    "positive state must still include the branded header",
  );
});

test("renderMarkdownReport: null and undefined findings also render the positive state, no throw", () => {
  const summary = { files_scanned: 5, files_flagged: 0, errors: 0, warnings: 0 };
  assert.ok(renderMarkdownReport(null, summary).includes("✅ No issues found"));
  assert.ok(renderMarkdownReport(undefined, summary).includes("✅ No issues found"));
});

test("renderMarkdownReport: pipe characters in fix text and file paths are escaped, table row not broken", () => {
  const findings = [
    { rule: "r1", severity: "critical", file: "src/a|b.tsx", line: 1, fix: "use a | b" },
  ];
  const summary = { files_scanned: 1, files_flagged: 1, errors: 1, warnings: 0 };
  const out = renderMarkdownReport(findings, summary);

  assert.ok(out.includes("use a \\| b"), "fix text pipe must be escaped");
  assert.ok(out.includes("a\\|b.tsx"), "file path pipe must be escaped");
  const rowLine = out.split("\n").find((l) => l.includes("r1"));
  assert.ok(rowLine, "the finding row must be present");
  // Unescaped (unpreceded-by-backslash) pipes are the real cell delimiters.
  const unescapedPipes = rowLine.replace(/\\\|/g, "").split("|").length - 1;
  assert.equal(unescapedPipes, 5, "row must still have exactly 4 table cells (5 unescaped pipe delimiters)");
});

test("renderMarkdownReport: findings with only warnings omit the errors accordion entirely", () => {
  const findings = [{ rule: "r1", severity: "warn", file: "a.tsx", line: 1, fix: "f1" }];
  const summary = { files_scanned: 1, files_flagged: 1, errors: 0, warnings: 1 };
  const out = renderMarkdownReport(findings, summary);

  assert.ok(!out.includes("errors</summary>"), "no errors section should be rendered when there are zero errors");
  assert.ok(out.includes("1 warnings</summary>"), "warnings section must still be rendered");
});

test("renderMarkdownReport: file:line column renders a relative path, not the fixture's absolute prefix", () => {
  const absFile = path.join(process.cwd(), "src", "nested", "deep.tsx");
  const findings = [{ rule: "r1", severity: "critical", file: absFile, line: 7, fix: "f1" }];
  const summary = { files_scanned: 1, files_flagged: 1, errors: 1, warnings: 0 };
  const out = renderMarkdownReport(findings, summary);

  assert.ok(!out.includes(process.cwd()), "output must not contain the absolute cwd prefix");
  assert.ok(out.includes("src/nested/deep.tsx:7"), "output must contain the relative file:line");
});

// ---------------------------------------------------------------------------
// Slice C2 — --review-json CLI flag (integration, real git repo + real CLI
// invocation, no gh/network calls).
// ---------------------------------------------------------------------------

test("integration: --review-json requires --scope changed, else exits 2 with an error", () => {
  const { dir, baseSha } = buildScopeFixtureRepo();
  try {
    const { stderr, exitCode } = runCli([".", "--review-json", "--base", baseSha], { cwd: dir });
    assert.equal(exitCode, 2);
    assert.ok(/requires --scope changed/.test(stderr), "must explain the --scope changed requirement");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: --review-json with --scope changed emits a Reviews API payload for the new file only", () => {
  const { dir, baseSha } = buildScopeFixtureRepo();
  try {
    const { stdout, exitCode } = runCli(
      [".", "--scope", "changed", "--base", baseSha, "--review-json", "--commit-sha", "deadbeef", "--fail-on", "none"],
      { cwd: dir },
    );
    assert.equal(exitCode, 0);
    const review = JSON.parse(stdout);
    assert.equal(review.commit_id, "deadbeef");
    assert.equal(review.event, "COMMENT");
    assert.ok(review.comments.length > 0, "must include at least one comment for the new/changed file");
    assert.ok(
      review.comments.every((c) => c.path.includes("changed.tsx")),
      "must only include comments for the new/changed file, not the pre-existing untouched one",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: --review-json defaults commit_id to HEAD when --commit-sha is omitted", () => {
  const { dir, baseSha } = buildScopeFixtureRepo();
  try {
    const headSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
    const { stdout, exitCode } = runCli(
      [".", "--scope", "changed", "--base", baseSha, "--review-json", "--fail-on", "none"],
      { cwd: dir },
    );
    assert.equal(exitCode, 0);
    const review = JSON.parse(stdout);
    assert.equal(review.commit_id, headSha);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: --review-json prints null when no findings survive --scope changed filtering", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-craft-detect-reviewjson-empty-"));
  const git = (args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  try {
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "Test"]);
    fs.writeFileSync(path.join(dir, "clean.ts"), "export const x = 1;\n");
    git(["add", "."]);
    git(["commit", "-q", "-m", "base"]);
    const baseSha = git(["rev-parse", "HEAD"]).trim();
    fs.writeFileSync(path.join(dir, "clean.ts"), "export const x = 2;\n");
    git(["add", "."]);
    git(["commit", "-q", "-m", "still clean"]);

    const { stdout, exitCode } = runCli(
      [".", "--scope", "changed", "--base", baseSha, "--review-json", "--fail-on", "none"],
      { cwd: dir },
    );
    assert.equal(exitCode, 0);
    assert.equal(stdout.trim(), "null");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Slice C2 — inline-comments bash step inside renderGHAWorkflow. Pure-function
// assertions on the generated YAML string only; the `gh api .../reviews`
// invocation itself is NOT unit-tested — untestable without a live PR. See
// the manual smoke-test checklist in tasks (Phase C2).
// ---------------------------------------------------------------------------

test("renderGHAWorkflow: inlineComments=true includes the inline-review-comments step gated on pull_request", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  assert.ok(yaml.includes("Post inline review comments"), "must include the inline-comments step");
  assert.ok(
    yaml.includes("if: always() && github.event_name == 'pull_request'"),
    "inline-comments step must be gated on pull_request and run even if the scan step failed (always())",
  );
});

test("renderGHAWorkflow: inline-comments step invokes --review-json with --scope changed and pipes to gh api --input", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);
  const stepIdx = yaml.indexOf("Post inline review comments");
  assert.ok(stepIdx !== -1, "inline-comments step must be present");
  const stepBlock = yaml.slice(stepIdx, stepIdx + 900);

  assert.ok(
    stepBlock.includes("--scope changed") && stepBlock.includes("--review-json"),
    "must invoke the CLI with --scope changed --review-json to build the payload",
  );
  assert.ok(
    stepBlock.includes("gh api --method POST") && stepBlock.includes("/reviews") && stepBlock.includes("--input"),
    "must POST the payload to the pulls/{pr}/reviews endpoint via --input (full JSON body from file), not -f/-F field flags",
  );
  assert.ok(
    !/--input.*-f |{ -f .*reviews/.test(stepBlock),
    "must not mix --input with -f/-F field flags for the reviews POST",
  );
});

test("renderGHAWorkflow: inline-comments step has continue-on-error: true", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);
  const stepIdx = yaml.indexOf("Post inline review comments");
  const stepBlock = yaml.slice(stepIdx, stepIdx + 300);

  assert.ok(
    stepBlock.includes("continue-on-error: true"),
    "a 422 (force-push drift, renamed files) must never fail the job — the separate fail-on-derived scan step is the sole gate",
  );
});

test("renderGHAWorkflow: inline-comments step skips posting when the payload has zero comments", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);
  const stepIdx = yaml.indexOf("Post inline review comments");
  const stepBlock = yaml.slice(stepIdx, stepIdx + 900);

  assert.ok(
    /COMMENT_COUNT/.test(stepBlock) && /skipping review comment post/.test(stepBlock),
    "must guard against posting an empty/pointless review when no findings survive scope filtering",
  );
});

test("renderGHAWorkflow: inlineComments=false omits the inline-comments step (no new permission needed either way)", () => {
  const yaml = renderGHAWorkflow({ ...DEFAULT_GHA_CONFIG, inlineComments: false });

  assert.ok(
    !yaml.includes("Post inline review comments"),
    "inline-comments step must be omitted when inlineComments is false",
  );
  // pull-requests: write is already granted by Slice B for the sticky
  // comment; the Reviews API needs the same permission, no new grant.
  assert.ok(yaml.includes("pull-requests: write"), "pull-requests: write must remain present regardless");
  assert.ok(yaml.includes('"inlineComments":false'), "config marker must reflect inlineComments:false");
});

test("renderGHAWorkflow: pull-requests: write permission is not duplicated for the Reviews API — same grant as the sticky comment", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);
  const occurrences = yaml.split("pull-requests: write").length - 1;
  assert.equal(occurrences, 1, "pull-requests: write must be declared exactly once, covering both sticky comment and Reviews API");
});

test("CLI entry guard: main() still runs when invoked through a symlink (npx/npm bin resolution)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-symlink-"));
  const binDir = path.join(dir, "node_modules", ".bin");
  fs.mkdirSync(binDir, { recursive: true });
  const symlinkPath = path.join(binDir, "ui-craft-detect");
  fs.symlinkSync(DETECT_MJS, symlinkPath);

  try {
    const stdout = execFileSync(process.execPath, [symlinkPath, "--version"], { encoding: "utf8" });
    assert.match(
      stdout,
      /^ui-craft-detect v\d+\.\d+\.\d+/,
      "main() must run (and print the version) when detect.mjs is invoked via a symlink, not silently exit 0",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("renderGHAWorkflow: checkout uses fetch-depth: 0 so --scope changed/files can resolve a merge-base in CI", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);

  assert.ok(
    /fetch-depth:\s*0/.test(yaml),
    "default (depth-1) checkout has no history for merge-base resolution — --scope would always fall back to full scan in real CI, and inline-comments would 422 the whole review batch on out-of-diff findings",
  );
});

// ---------------------------------------------------------------------------
// Slice D — parseWorkflowConfig / replaceMarkers (pure marker round-trip)
// ---------------------------------------------------------------------------

test("parseWorkflowConfig: parses config and version markers out of a generated workflow", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG);
  const { config, version } = parseWorkflowConfig(yaml);

  assert.deepEqual(config, DEFAULT_GHA_CONFIG, "parsed config must deep-equal the config it was rendered from");
  assert.match(version, /^\d+\.\d+\.\d+$/, "version marker must be a semver string");
});

test("parseWorkflowConfig: throws a clear error when the config marker is missing", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG).replace(/^# ui-craft-detect-config:.*$/m, "");
  assert.throws(
    () => parseWorkflowConfig(yaml),
    /ui-craft-detect-config/,
    "must name the missing marker in the error",
  );
});

test("parseWorkflowConfig: throws a clear error when the version marker is missing", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG).replace(/^# ui-craft-detect-version:.*$/m, "");
  assert.throws(
    () => parseWorkflowConfig(yaml),
    /ui-craft-detect-version/,
    "must name the missing marker in the error",
  );
});

test("parseWorkflowConfig: throws (does not silently corrupt) on hand-edited invalid JSON in the config marker", () => {
  const yaml = renderGHAWorkflow(DEFAULT_GHA_CONFIG).replace(
    /^# ui-craft-detect-config:.*$/m,
    "# ui-craft-detect-config: {this is not valid json,,,}",
  );
  assert.throws(
    () => parseWorkflowConfig(yaml),
    /failed to parse/,
    "a hand-corrupted marker must raise, never be silently accepted",
  );
});

test("parseWorkflowConfig -> replaceMarkers round-trip: mutating one field preserves all others exactly", () => {
  const original = renderGHAWorkflow(DEFAULT_GHA_CONFIG);
  const { config: parsed } = parseWorkflowConfig(original);

  const mutated = { ...parsed, failOn: "warning" };
  const regenerated = replaceMarkers(mutated);
  const { config: reparsed } = parseWorkflowConfig(regenerated);

  assert.equal(reparsed.failOn, "warning", "the mutated field must take effect");
  for (const key of Object.keys(DEFAULT_GHA_CONFIG)) {
    if (key === "failOn") continue;
    assert.equal(reparsed[key], DEFAULT_GHA_CONFIG[key], `untouched key "${key}" must be preserved exactly`);
  }
});

test("parseWorkflowConfig -> replaceMarkers round-trip: config marker JSON round-trips byte-for-byte via JSON.parse", () => {
  const mutatedConfig = { ...DEFAULT_GHA_CONFIG, scope: "files", status: false };
  const regenerated = replaceMarkers(mutatedConfig);
  const { config: reparsed } = parseWorkflowConfig(regenerated);

  assert.deepEqual(reparsed, mutatedConfig, "round-tripped config must deep-equal the input config exactly");
});

test("replaceMarkers: regenerated YAML outside the managed marker lines matches a fresh render with the same config (steps/permissions untouched by the read-modify-write)", () => {
  const config = { ...DEFAULT_GHA_CONFIG, inlineComments: false };
  const freshRender = renderGHAWorkflow(config);
  const viaReplaceMarkers = replaceMarkers(config);

  assert.equal(
    viaReplaceMarkers,
    freshRender,
    "replaceMarkers must produce byte-identical output to a fresh renderGHAWorkflow call for the same config — template-authoritative regen, no partial patching",
  );
});

// ---------------------------------------------------------------------------
// Slice D — `ci install` / `ci config` / `ci upgrade` CLI subcommands
// ---------------------------------------------------------------------------

/** Builds a fresh temp git repo (no workflow installed yet). Returns the dir. */
function buildBareGitRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-craft-detect-ci-"));
  const git = (args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "Test"]);
  fs.writeFileSync(path.join(dir, "README.md"), "# fixture\n");
  git(["add", "."]);
  git(["commit", "-q", "-m", "init"]);
  return dir;
}

function runCiCli(args, opts = {}) {
  try {
    const stdout = execFileSync(process.execPath, [DETECT_MJS, "ci", ...args], {
      encoding: "utf8",
      ...opts,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err) {
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", exitCode: err.status };
  }
}

test("integration: ci install writes .github/workflows/ui-craft-detect.yml, equivalent to init-hook --github-action", () => {
  const dir = buildBareGitRepo();
  try {
    const { stdout, exitCode } = runCiCli(["install", "--yes"], { cwd: dir });
    assert.equal(exitCode, 0, `ci install must exit 0; stdout: ${stdout}`);

    const workflowPath = path.join(dir, ".github", "workflows", "ui-craft-detect.yml");
    assert.ok(fs.existsSync(workflowPath), "ci install must write the workflow file");

    const written = fs.readFileSync(workflowPath, "utf8");
    assert.equal(
      written,
      renderGHAWorkflow(DEFAULT_GHA_CONFIG),
      "ci install's output must be byte-identical to renderGHAWorkflow(DEFAULT_GHA_CONFIG), same as init-hook --github-action",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: ci config changes a setting without full reinstall, preserving untouched settings and surrounding YAML shape", () => {
  const dir = buildBareGitRepo();
  try {
    runCiCli(["install", "--yes"], { cwd: dir });
    const workflowPath = path.join(dir, ".github", "workflows", "ui-craft-detect.yml");

    const { stdout, exitCode } = runCiCli(["config", "--scope", "full"], { cwd: dir });
    assert.equal(exitCode, 0, `ci config must exit 0; stdout: ${stdout}`);

    const updated = fs.readFileSync(workflowPath, "utf8");
    const { config } = parseWorkflowConfig(updated);
    assert.equal(config.scope, "full", "requested field must be updated");
    assert.equal(config.failOn, DEFAULT_GHA_CONFIG.failOn, "untouched fields must be preserved");
    assert.equal(config.comment, DEFAULT_GHA_CONFIG.comment, "untouched fields must be preserved");

    // Must still be a fully valid, parseable render for the new config —
    // not a partial/corrupted patch.
    assert.equal(updated, renderGHAWorkflow(config), "rewritten file must equal a fresh render of the merged config");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: ci config errors clearly if no workflow is installed yet", () => {
  const dir = buildBareGitRepo();
  try {
    const { stderr, exitCode } = runCiCli(["config", "--scope", "full"], { cwd: dir });
    assert.equal(exitCode, 2);
    assert.match(stderr, /ci install/, "error must point the user at ci install");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: ci config with no flags errors instead of silently no-op-writing", () => {
  const dir = buildBareGitRepo();
  try {
    runCiCli(["install", "--yes"], { cwd: dir });
    const { stderr, exitCode } = runCiCli(["config"], { cwd: dir });
    assert.equal(exitCode, 2);
    assert.match(stderr, /at least one setting/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: ci upgrade is a no-op (exit 0, unchanged file) when the version marker already matches the current version", () => {
  const dir = buildBareGitRepo();
  try {
    runCiCli(["install", "--yes"], { cwd: dir });
    const workflowPath = path.join(dir, ".github", "workflows", "ui-craft-detect.yml");
    const before = fs.readFileSync(workflowPath, "utf8");

    const { stdout, exitCode } = runCiCli(["upgrade"], { cwd: dir });
    assert.equal(exitCode, 0, `ci upgrade must exit 0 cleanly when already current; stdout: ${stdout}`);
    assert.match(stdout, /already up to date/);

    const after = fs.readFileSync(workflowPath, "utf8");
    assert.equal(after, before, "no-op upgrade must not touch the file");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: ci upgrade regenerates the template body and bumps the version marker while preserving config when version marker is stale", () => {
  const dir = buildBareGitRepo();
  try {
    runCiCli(["install", "--yes"], { cwd: dir });
    const workflowPath = path.join(dir, ".github", "workflows", "ui-craft-detect.yml");

    // Simulate an older install: rewrite the version marker to an old value
    // and change one config field, exactly like a real stale install would
    // have both an old version marker and a user's customized config.
    const staleConfig = { ...DEFAULT_GHA_CONFIG, failOn: "warning" };
    const staleText = renderGHAWorkflow(staleConfig).replace(
      /^# ui-craft-detect-version:.*$/m,
      "# ui-craft-detect-version: 0.1.0",
    );
    fs.writeFileSync(workflowPath, staleText, "utf8");

    const { stdout, exitCode } = runCiCli(["upgrade"], { cwd: dir });
    assert.equal(exitCode, 0, `ci upgrade must exit 0; stdout: ${stdout}`);
    assert.match(stdout, /0\.1\.0/, "must report the old version in its output");

    const after = fs.readFileSync(workflowPath, "utf8");
    const { config, version } = parseWorkflowConfig(after);
    assert.notEqual(version, "0.1.0", "version marker must be bumped");
    assert.equal(config.failOn, "warning", "user's config must be preserved across the upgrade, not reset to defaults");
    assert.equal(after, renderGHAWorkflow(config), "post-upgrade file must equal a fresh render of the preserved config at the current version");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: ci upgrade errors clearly if no workflow is installed yet", () => {
  const dir = buildBareGitRepo();
  try {
    const { stderr, exitCode } = runCiCli(["upgrade"], { cwd: dir });
    assert.equal(exitCode, 2);
    assert.match(stderr, /ci install/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: ci with no/unknown subcommand prints help and exits non-zero", () => {
  const dir = buildBareGitRepo();
  try {
    const noneResult = runCiCli([], { cwd: dir });
    assert.equal(noneResult.exitCode, 2);

    const unknownResult = runCiCli(["frobnicate"], { cwd: dir });
    assert.equal(unknownResult.exitCode, 2);
    assert.match(unknownResult.stderr, /unknown ci subcommand/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: init-hook --github-action still works unchanged post-Slice-D (backward compatibility)", () => {
  const dir = buildBareGitRepo();
  try {
    const stdout = execFileSync(process.execPath, [DETECT_MJS, "init-hook", "--github-action", "--yes"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.match(stdout, /wrote/);

    const workflowPath = path.join(dir, ".github", "workflows", "ui-craft-detect.yml");
    const written = fs.readFileSync(workflowPath, "utf8");
    assert.equal(
      written,
      renderGHAWorkflow(DEFAULT_GHA_CONFIG),
      "init-hook --github-action must remain byte-identical to its pre-Slice-D output",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Agent edit-time hooks — manifest builders (pure) + CLI integration
// ---------------------------------------------------------------------------
test("buildClaudeHookSettings installs a PostToolUse entry and is idempotent", () => {
  const first = buildClaudeHookSettings(null);
  assert.equal(first.changed, true);
  const entries = first.next.hooks.PostToolUse;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].matcher, "Edit|Write|MultiEdit");
  assert.match(entries[0].hooks[0].command, /ui-craft-detect hook-run/);

  const second = buildClaudeHookSettings(first.next);
  assert.equal(second.changed, false, "re-install must be a no-op");
  assert.equal(second.next.hooks.PostToolUse.length, 1, "must not duplicate the entry");
});

test("buildClaudeHookSettings preserves unrelated settings and hook entries", () => {
  const current = {
    permissions: { allow: ["Bash(npm run *)"] },
    hooks: {
      PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo done" }] }],
      Stop: [{ matcher: "", hooks: [{ type: "command", command: "notify" }] }],
    },
  };
  const { next, changed } = buildClaudeHookSettings(current);
  assert.equal(changed, true);
  assert.deepEqual(next.permissions, current.permissions, "unrelated top-level keys must survive");
  assert.equal(next.hooks.PostToolUse.length, 2, "existing PostToolUse entries must survive");
  assert.equal(next.hooks.PostToolUse[0].hooks[0].command, "echo done");
  assert.equal(next.hooks.Stop.length, 1, "other hook events must survive");

  const removed = buildClaudeHookSettings(next, { remove: true });
  assert.equal(removed.changed, true);
  assert.equal(removed.next.hooks.PostToolUse.length, 1, "remove must only strip the detector entry");
  assert.equal(removed.next.hooks.PostToolUse[0].hooks[0].command, "echo done");
});

test("buildCursorHookSettings installs an afterFileEdit entry, idempotent, removable", () => {
  const first = buildCursorHookSettings(null);
  assert.equal(first.changed, true);
  assert.equal(first.next.version, 1, "must emit schema version 1");
  assert.match(first.next.hooks.afterFileEdit[0].command, /ui-craft-detect hook-run/);

  const second = buildCursorHookSettings(first.next);
  assert.equal(second.changed, false);

  const withOther = buildCursorHookSettings({
    version: 1,
    hooks: { afterFileEdit: [{ command: "./hooks/format.sh" }] },
  });
  assert.equal(withOther.next.hooks.afterFileEdit.length, 2, "existing entries must survive");

  const removed = buildCursorHookSettings(withOther.next, { remove: true });
  assert.equal(removed.next.hooks.afterFileEdit.length, 1);
  assert.equal(removed.next.hooks.afterFileEdit[0].command, "./hooks/format.sh");
});

function runDetectCli(args, opts = {}) {
  try {
    const stdout = execFileSync(process.execPath, [DETECT_MJS, ...args], {
      encoding: "utf8",
      ...opts,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err) {
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", exitCode: err.status };
  }
}

test("integration: hooks install writes both manifests; uninstall removes them; status reports", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-craft-detect-hooks-"));
  try {
    const install = runDetectCli(["hooks", "install"], { cwd: dir });
    assert.equal(install.exitCode, 0, install.stderr);

    const claude = JSON.parse(fs.readFileSync(path.join(dir, ".claude", "settings.json"), "utf8"));
    assert.match(claude.hooks.PostToolUse[0].hooks[0].command, /ui-craft-detect hook-run/);
    const cursor = JSON.parse(fs.readFileSync(path.join(dir, ".cursor", "hooks.json"), "utf8"));
    assert.equal(cursor.version, 1);
    assert.match(cursor.hooks.afterFileEdit[0].command, /ui-craft-detect hook-run/);

    const again = runDetectCli(["hooks", "install"], { cwd: dir });
    assert.match(again.stdout, /already installed/, "second install must be a no-op");

    const status = runDetectCli(["hooks", "status"], { cwd: dir });
    assert.match(status.stdout, /claude\s+installed/);
    assert.match(status.stdout, /cursor\s+installed/);

    const uninstall = runDetectCli(["hooks", "uninstall"], { cwd: dir });
    assert.equal(uninstall.exitCode, 0);
    const statusAfter = runDetectCli(["hooks", "status"], { cwd: dir });
    assert.match(statusAfter.stdout, /claude\s+not installed/);
    assert.match(statusAfter.stdout, /cursor\s+not installed/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: hooks install --dry-run prints manifests without writing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-craft-detect-hooks-"));
  try {
    const { stdout, exitCode } = runDetectCli(["hooks", "install", "--dry-run"], { cwd: dir });
    assert.equal(exitCode, 0);
    assert.match(stdout, /\.claude\/settings\.json/);
    assert.match(stdout, /\.cursor\/hooks\.json/);
    assert.ok(!fs.existsSync(path.join(dir, ".claude")), "dry-run must not write .claude/");
    assert.ok(!fs.existsSync(path.join(dir, ".cursor")), "dry-run must not write .cursor/");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: hook-run exits 2 with findings summary for a slop edit (Claude Code payload)", () => {
  const payload = JSON.stringify({ tool_input: { file_path: SLOP_FIXTURE } });
  const result = runDetectCli(["hook-run"], { input: payload });
  assert.equal(result.exitCode, 2, "critical/major findings must exit 2 (agent feedback)");
  assert.match(result.stderr, /design finding/);
  assert.match(result.stderr, /L\d+ \[(critical|major)\]/);
});

test("integration: hook-run exits 0 silently for a clean edit (Cursor payload)", () => {
  const payload = JSON.stringify({ file_path: CLEAN_FIXTURE });
  const result = runDetectCli(["hook-run"], { input: payload });
  assert.equal(result.exitCode, 0, result.stderr);
});

test("integration: hook-run fails open on non-scannable files and malformed stdin", () => {
  const mdPayload = JSON.stringify({ tool_input: { file_path: "/tmp/some-notes.md" } });
  assert.equal(runDetectCli(["hook-run"], { input: mdPayload }).exitCode, 0);
  assert.equal(runDetectCli(["hook-run"], { input: "not json{{" }).exitCode, 0);
  assert.equal(runDetectCli(["hook-run"], { input: "" }).exitCode, 0);
});

// ---------------------------------------------------------------------------
// URL scanning — scanUrl() + CLI URL mode (fetch engine; puppeteer not in CI)
// ---------------------------------------------------------------------------
const SLOP_HTML = `<!doctype html><html><head><title>t</title></head><body>
<div class="bg-gradient-to-r from-purple-500 to-cyan-400 transition-all">
<button>Get Started</button>
</div></body></html>`;

async function withHtmlServer(html, fn) {
  const { createServer } = await import("node:http");
  const server = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  try {
    return await fn(url);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("scanUrl() scans live HTML over the fetch engine and reports the URL as file", async () => {
  await withHtmlServer(SLOP_HTML, async (url) => {
    const result = await scanUrl(url, { engine: "fetch" });
    assert.equal(result.engine, "fetch");
    assert.equal(result.summary.files_scanned, 1);
    const ruleIds = result.findings.map((f) => f.rule);
    assert.ok(ruleIds.includes("transition-all"), `expected transition-all in ${ruleIds}`);
    assert.ok(ruleIds.includes("purple-cyan-gradient"), `expected purple-cyan-gradient in ${ruleIds}`);
    assert.equal(result.findings[0].file, url, "findings must report the URL as file");
  });
});

test("scanUrl() returns a structured error for unreachable URLs (no throw)", async () => {
  const result = await scanUrl("http://127.0.0.1:9/", { engine: "fetch", timeoutMs: 2000 });
  assert.ok(result.error, "must set error field");
  assert.equal(result.findings.length, 0);
});

// execFileSync would block the parent event loop and starve the in-process
// HTTP server the child is fetching from — URL CLI tests must spawn async.
async function runDetectCliAsync(args) {
  const { spawn } = await import("node:child_process");
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [DETECT_MJS, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (exitCode) => resolve({ stdout, stderr, exitCode }));
  });
}

test("integration: CLI URL mode outputs --json with engine field and honors --fail-on", async () => {
  await withHtmlServer(SLOP_HTML, async (url) => {
    const failing = await runDetectCliAsync([url, "--json", "--engine", "fetch"]);
    assert.equal(failing.exitCode, 1, `critical findings must exit 1; stderr: ${failing.stderr}`);
    const parsed = JSON.parse(failing.stdout);
    assert.equal(parsed.engine, "fetch");
    assert.ok(parsed.findings.length >= 2);

    const advisory = await runDetectCliAsync([url, "--json", "--engine", "fetch", "--fail-on", "none"]);
    assert.equal(advisory.exitCode, 0, "--fail-on none must exit 0");
  });
});

test("integration: CLI URL mode rejects file-oriented flags", async () => {
  const result = runDetectCli(["https://example.com", "--fix"]);
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /not supported for URL scans/);
});

// ---------------------------------------------------------------------------
// Regression: five defects found by scoring our own before/after scenes, where
// three of four "with ui-craft" pages scored WORSE than their slop counterpart.
// See the issue "detect: 3 of 4 with-scenes score worse than without".
// ---------------------------------------------------------------------------

async function scanOne(name, contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-regression-"));
  fs.writeFileSync(path.join(dir, name), contents);
  return scan(dir);
}

test("transition-all does not match its own rule name (`no-transition-all`)", async () => {
  const result = await scanOne(
    "rules.html",
    `<div class="t-row"><span class="t-rule">no-transition-all</span></div>\n` +
      `<pre>{ "no-transition-all": "error" }</pre>\n`,
  );
  const hits = result.findings.filter((f) => f.rule === "transition-all");
  assert.equal(hits.length, 0, `naming the rule must not trip it: ${JSON.stringify(hits)}`);
});

test("line rules skip patterns shown inside <code> or on a deleted diff line", async () => {
  const result = await scanOne(
    "docs.html",
    `<p>Avoid <code class="mono">transition: all</code> in production.</p>\n` +
      `<div class="diff"><span class="rem">transition: all 300ms ease;</span></div>\n` +
      `<del>transition: all 200ms;</del>\n`,
  );
  const hits = result.findings.filter((f) => f.rule === "transition-all");
  assert.equal(hits.length, 0, `quoted and removed lines are not usages: ${JSON.stringify(hits)}`);
});

test("line rules still catch a real usage on an ordinary line", async () => {
  const result = await scanOne("real.css", `.card { transition: all 200ms ease; }\n`);
  const hits = result.findings.filter((f) => f.rule === "transition-all");
  assert.equal(hits.length, 1, "the guard must not swallow genuine findings");
});

test("icon-only-button reads to </button>, so text after a multi-line SVG counts", async () => {
  const result = await scanOne(
    "buttons.html",
    `<button class="ghost">\n` +
      `  <svg viewBox="0 0 24 24" aria-hidden="true">\n` +
      `    <rect x="3" y="5" width="18" height="16" rx="2"/>\n` +
      `    <path d="M16 3v4M8 3v4M3 10h18"/>\n` +
      `    <path d="M6 9l6 6 6-6"/>\n` +
      `  </svg>\n` +
      `  Last 30 days\n` +
      `</button>\n`,
  );
  const hits = result.findings.filter((f) => f.rule === "a11y/icon-only-button-no-label");
  assert.equal(hits.length, 0, `button has a visible label: ${JSON.stringify(hits)}`);
});

test("icon-only-button still flags a button that really is icon-only", async () => {
  const result = await scanOne(
    "iconbtn.html",
    `<button class="close">\n  <svg viewBox="0 0 24 24">\n    <path d="M6 6l12 12M18 6L6 18"/>\n  </svg>\n</button>\n`,
  );
  const hits = result.findings.filter((f) => f.rule === "a11y/icon-only-button-no-label");
  assert.equal(hits.length, 1, "an unlabelled icon button is still a finding");
});

test("uppercase-heading honours its documented small-tracked-label exception", async () => {
  const result = await scanOne(
    "footer.css",
    `.footer-col h3{ font-size:11px; letter-spacing:0.05em; text-transform:uppercase; }\n`,
  );
  const hits = result.findings.filter((f) => f.rule === "uppercase-heading");
  assert.equal(hits.length, 0, "11px tracked label is the exception in SKILL.md rule 1");
});

test("uppercase-heading still flags a shouting heading", async () => {
  const result = await scanOne("hero.css", `h1{ font-size:48px; text-transform:uppercase; }\n`);
  const hits = result.findings.filter((f) => f.rule === "uppercase-heading");
  assert.equal(hits.length, 1, "a 48px uppercase h1 is the pattern the rule exists for");
});

test("purple-cyan-gradient reads CSS colour values, not just Tailwind classes", async () => {
  const result = await scanOne(
    "hero.css",
    `.hero{ background: linear-gradient(135deg, #a855f7 0%, #06b6d4 100%); }\n`,
  );
  const hits = result.findings.filter((f) => f.rule === "purple-cyan-gradient");
  assert.equal(hits.length, 1, "the same tell in hex must be caught");
});

test("purple-cyan-gradient leaves a neutral gradient alone", async () => {
  const result = await scanOne(
    "surface.css",
    `.surface{ background: linear-gradient(180deg, #fafafa 0%, #eeeeee 100%); }\n`,
  );
  const hits = result.findings.filter((f) => f.rule === "purple-cyan-gradient");
  assert.equal(hits.length, 0, "greys have no hue and must not be flagged");
});

test("gradient-text-metric catches background-clip: text in raw CSS", async () => {
  const result = await scanOne(
    "metric.css",
    `.metric{\n  background: linear-gradient(90deg, #a855f7, #06b6d4);\n  -webkit-background-clip: text;\n  -webkit-text-fill-color: transparent;\n}\n`,
  );
  const hits = result.findings.filter((f) => f.rule === "gradient-text-metric");
  assert.equal(hits.length, 1, "gradient clipped to glyphs, expressed as CSS");
});

test("emoji-feature-icon catches an emoji used as an element's whole content", async () => {
  const result = await scanOne("features.html", `<div class="feature-icon">✨</div>\n`);
  const hits = result.findings.filter((f) => f.rule === "emoji-feature-icon");
  assert.equal(hits.length, 1, "an emoji alone in an element is an icon");
});

test("emoji-feature-icon leaves typographic glyphs like a check mark alone", async () => {
  const result = await scanOne("status.html", `<span class="ok">✓</span>\n`);
  const hits = result.findings.filter((f) => f.rule === "emoji-feature-icon");
  assert.equal(hits.length, 0, "U+2713 is a text-presentation glyph, not an emoji icon");
});

test("a rule does not flag the comment that documents it", async () => {
  const result = await scanOne(
    "note.astro",
    `---\n---\n{/* We avoid transition-all because it animates properties nobody named. */}\n<p>copy</p>\n`,
  );
  assert.equal(
    result.findings.length,
    0,
    "prose describing a pattern is not the pattern",
  );
});

test("a CSS block comment naming a pattern is not the pattern", async () => {
  const result = await scanOne(
    "note.css",
    `/* Never write transition: all here — name the properties. */\n.a{ transition: opacity 200ms; }\n`,
  );
  assert.equal(result.findings.length, 0, "a block comment is documentation");
});

test("a multi-line comment stays suppressed across its lines", async () => {
  const result = await scanOne(
    "note.css",
    `/*\n  transition: all is the shorthand we reject.\n  So is a purple-to-cyan gradient: linear-gradient(90deg, #a855f7, #06b6d4).\n*/\n.a{ color: #111; }\n`,
  );
  assert.equal(result.findings.length, 0, "the span covers every line of the comment");
});

test("code after a comment on the same line is still read", async () => {
  const result = await scanOne(
    "mixed.astro",
    `---\n---\n<div class="transition-all">x</div>{/* a trailing note */}\n`,
  );
  const hits = result.findings.filter((f) => f.rule === "transition-all");
  assert.equal(hits.length, 1, "only the comment's own columns are exempt");
});

test("a URL's double slash does not start a comment", async () => {
  const result = await scanOne(
    "link.astro",
    `---\n---\n<a href="https://example.com" class="transition-all">y</a>\n`,
  );
  const hits = result.findings.filter((f) => f.rule === "transition-all");
  assert.equal(hits.length, 1, "`://` is a scheme, not a line comment");
});

test("a pattern inside a quoted string is not treated as a comment", async () => {
  const result = await scanOne(
    "conf.ts",
    `export const cls = "transition-all duration-200"; // applied by the wrapper\n`,
  );
  const hits = result.findings.filter((f) => f.rule === "transition-all");
  assert.equal(hits.length, 1, "the class is shipped; only the trailing note is prose");
});

test("image-height-from-attribute ignores a wrapper that only declares an aspect ratio", async () => {
  const result = await scanOne(
    "card.astro",
    `---\n---\n<div class="shot-frame"><img src="/a.webp" width="1100" height="619" /></div>\n<style>\n  .shot-frame { width: 100%; aspect-ratio: 16 / 9; overflow: hidden; }\n  .shot-frame img { width: 100%; height: 100%; object-fit: cover; }\n</style>\n`,
  );
  const hits = result.findings.filter((f) => f.rule === "layout/image-height-from-attribute");
  assert.equal(hits.length, 0, "a div no image wears is the box, not the image");
});

test("image-height-from-attribute reads the cascade, not one block", async () => {
  const result = await scanOne(
    "pair.astro",
    `---\n---\n<img class="pane" src="/a.webp" width="1100" height="619" />\n<style>\n  .pane { width: 106%; height: auto; }\n  @media (max-width: 40rem) {\n    .pane { width: 100%; }\n  }\n</style>\n`,
  );
  const hits = result.findings.filter((f) => f.rule === "layout/image-height-from-attribute");
  assert.equal(hits.length, 0, "the override restates width; the base rule set height");
});

test("image-height-from-attribute still catches an image sized on one axis", async () => {
  const result = await scanOne(
    "hero.astro",
    `---\n---\n<img class="thumb" src="/a.webp" width="900" height="600" />\n<style>\n  .thumb { width: 100%; object-fit: cover; }\n</style>\n`,
  );
  const hits = result.findings.filter((f) => f.rule === "layout/image-height-from-attribute");
  assert.equal(hits.length, 1, "the height attribute is left deciding the other axis");
});

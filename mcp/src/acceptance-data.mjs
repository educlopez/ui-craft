/**
 * acceptance-data.mjs
 * Deterministic acceptance-bar checklist data, hand-derived from recipe-*.md + finish-bar.md.
 * ESM module (not JSON) so it inlines cleanly into the published bundle and loads from
 * source on every Node version without import attributes. Edit here; this is the source of truth.
 */
export default {
  "_note": "Hand-derived from references/recipe-dashboard.md, recipe-landing.md, recipe-auth.md (## Acceptance bar sections), references/craft-intent.md, and references/finish-bar.md (10 passes). Regen-on-recipe-edit: update manually when recipe files change (v1 — no generator). Version: ui-craft v0.35.0.",
  "dashboard": [
    {
      "id": "dash-01",
      "description": "Squint test: eye lands on exactly ONE thing first (the hero)",
      "category": "hierarchy"
    },
    {
      "id": "dash-02",
      "description": "One accent color, at most 5 placements in the viewport; everything else neutral",
      "category": "color"
    },
    {
      "id": "dash-03",
      "description": "At least 3 content types above the fold; NO equal-weight card grid anywhere",
      "category": "layout"
    },
    {
      "id": "dash-04",
      "description": "Every number uses tabular-nums; every comparison is plain secondary text (no pills, no arrows)",
      "category": "typography"
    },
    {
      "id": "dash-05",
      "description": "Empty, loading, and error states exist and match layout geometry",
      "category": "states"
    },
    {
      "id": "dash-06",
      "description": "Date range or equivalent time control present on time-series surfaces",
      "category": "functionality"
    },
    {
      "id": "dash-07",
      "description": "Keyboard: tab order logical, focus visible, table rows keyboard-reachable",
      "category": "accessibility"
    },
    {
      "id": "dash-08",
      "description": "Sidebar tinted (not black), headers sentence case, no uppercase anywhere except 11-13px tracked labels",
      "category": "typography"
    },
    {
      "id": "dash-09",
      "description": "Charts: correct type per data story, single-hue opacity ramp, no legend for single series",
      "category": "dataviz"
    },
    {
      "id": "dash-10",
      "description": "prefers-reduced-motion honored; all transitions at most 400ms",
      "category": "motion"
    },
    {
      "id": "dash-11",
      "description": "Craft Read declared before code; exactly one signature bet from the product list, built in the first pass (not deferred to polish)",
      "category": "craft"
    }
  ],
  "landing": [
    {
      "id": "land-01",
      "description": "Squint test on the hero: H1 then primary CTA, in that order; nothing competes",
      "category": "hierarchy"
    },
    {
      "id": "land-02",
      "description": "One conversion action; every section advances it",
      "category": "conversion"
    },
    {
      "id": "land-03",
      "description": "Product/visual cropped at fold or edge (scroll tease); no visual floating in dead air",
      "category": "layout"
    },
    {
      "id": "land-04",
      "description": "CTA hierarchy: 3 distinct levels, no ties",
      "category": "hierarchy"
    },
    {
      "id": "land-05",
      "description": "At least one specific, attributed proof point; zero unattributed superlatives",
      "category": "copy"
    },
    {
      "id": "land-06",
      "description": "No uniform icon-card grid anywhere",
      "category": "layout"
    },
    {
      "id": "land-07",
      "description": "Section spacing 80-160px, varied; every section answers one question",
      "category": "layout"
    },
    {
      "id": "land-08",
      "description": "One signature detail, exactly one",
      "category": "craft"
    },
    {
      "id": "land-09",
      "description": "Mobile: hero readable without zoom, CTAs thumb-reachable, no horizontal scroll",
      "category": "responsive"
    },
    {
      "id": "land-10",
      "description": "prefers-reduced-motion honored; entrances at most 400ms; no scroll-jacking",
      "category": "motion"
    },
    {
      "id": "land-11",
      "description": "Craft Read declared; DESIGN_VARIANCE and signature bet match the built page; no two adjacent sections share the same layout",
      "category": "craft"
    }
  ],
  "auth": [
    {
      "id": "auth-01",
      "description": "Squint test: eye lands on the submit button; accent appears ONLY on submit and links",
      "category": "hierarchy"
    },
    {
      "id": "auth-02",
      "description": "No saturated full-bleed brand panel; panel (if any) is tinted neutral with one proof asset",
      "category": "color"
    },
    {
      "id": "auth-03",
      "description": "Form column 360-400px, labels above, no asterisks, divider lowercase",
      "category": "forms"
    },
    {
      "id": "auth-04",
      "description": "Forgot password findable without scanning; sibling flow cross-linked",
      "category": "usability"
    },
    {
      "id": "auth-05",
      "description": "Submit enabled and validates on press; errors below fields, focus managed",
      "category": "forms"
    },
    {
      "id": "auth-06",
      "description": "Keyboard: tab order top-to-bottom, Enter submits, focus visible on every control",
      "category": "accessibility"
    },
    {
      "id": "auth-07",
      "description": "Trust signals present (compliance line or equivalent) and honest",
      "category": "trust"
    },
    {
      "id": "auth-08",
      "description": "Works at 320px wide: panel drops, form survives alone",
      "category": "responsive"
    },
    {
      "id": "auth-09",
      "description": "Craft Read declared; variance 4 unless brief overrides; exactly one auth signature bet (panel proof asset, trust footer, or domain welcome) built in the first pass",
      "category": "craft"
    }
  ],
  "generic": [
    {
      "id": "fin-01",
      "description": "Pass 1 Hierarchy: squint test passes — one element dominates; adjacent levels differ by at least 1.5x in one signal",
      "category": "hierarchy"
    },
    {
      "id": "fin-02",
      "description": "Pass 2 Type System: at most 3 font weights visible; tabular-nums on all numeric data; body line-length 50-75 chars",
      "category": "typography"
    },
    {
      "id": "fin-03",
      "description": "Pass 3 Surface Stack: at least 3 distinguishable elevation levels; dark mode is not inverted light; color-scheme declared",
      "category": "surface"
    },
    {
      "id": "fin-04",
      "description": "Pass 4 Spacing Rhythm: every spacing value from token scale; within < between < section at every nesting level",
      "category": "spacing"
    },
    {
      "id": "fin-05",
      "description": "Pass 5 Iconography: single icon family throughout; stroke weight matches body type; container shape consistent",
      "category": "iconography"
    },
    {
      "id": "fin-06",
      "description": "Pass 6 State Coverage: all 8 states designed (idle, loading, empty, error, success, partial, conflict, offline)",
      "category": "states"
    },
    {
      "id": "fin-07",
      "description": "Pass 7 Motion Tuning: UI transitions 100-400ms; easings have perceptual basis; prefers-reduced-motion honored",
      "category": "motion"
    },
    {
      "id": "fin-08",
      "description": "Pass 8 Microcopy Voice: verbs consistent; no placeholder copy; every CTA names the specific outcome",
      "category": "copy"
    },
    {
      "id": "fin-09",
      "description": "Pass 9 Pixel Honesty: shadow stacks 2-3 layers; corner radii vary by element role; overflow handled on every text container",
      "category": "craft"
    },
    {
      "id": "fin-10",
      "description": "Pass 10 Data Formatting: tabular-nums on all data display; counts abbreviated correctly; relative vs absolute time intentional",
      "category": "data"
    }
  ]
};

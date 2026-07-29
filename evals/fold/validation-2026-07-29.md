# Fold composition — before and after

Blind builds, fresh contexts, Sonnet, two unrelated briefs: a webhook devtool
landing and a handmade ceramics studio landing. Each agent read a copy of the
skill and built from a one-line request. No agent could see another.

## Before — ten runs, one fold

Four conditions were tried: the hero **prescribed** in `SKILL.md`, the
prescription **removed** and replaced with seven form-free invariants, the
archetype catalogue demoted from a menu to examples, and finally the fold
**explicitly forbidden** in the Critical anti-slop list.

| condition | devtool | ceramics |
|---|---|---|
| installed skill (v1.0.0-era) | split | split |
| repo main | split | split |
| main + invariants | split | split |
| main + explicit prohibition | split | split |

**10 of 10 produced the same fold**: headline left, visual right cropped at the
viewport edge, floating proof card over it. One run reframed the forbidden
full-bleed crop as its "signature element". Two independent runs chose the same
rotated accent — graphite and teal — with near-identical justification wording.

No prose intervention moved it. Prescribing, permitting and forbidding all
converge; they only differ in where.

## After — the class is drawn, not chosen

`/craft` now calls `fold_candidates`, which draws three composition classes from
the ones the project has not spent, records the choice in the brief, and
demotes `split` to last because it is the fold every generator returns to.

| run | class committed | hero |
|---|---|---|
| dev-a | `stacked` | headline left, CTAs above a full-width screenshot |
| dev-b | `stacked` | centred text block, full-width dashboard beneath, cropped mid-row |
| ceramic-a | `full-bleed-overlay` | studio photograph edge to edge, headline scrimmed on top |
| ceramic-b | `full-bleed-overlay` | potter at the wheel, scrim, headline and CTAs lower-left |

**0 of 4 produced a split.** Unrelated briefs produced different classes.
Colour diverged for the first time across all four runs — graphite/teal, warm
neutral with a custom amber, mono with a kiln-flame pop, cobalt and bone —
where the earlier pairs had matched exactly.

## What did not move

**Runs of the same brief commit to the same class.** The draw is deterministic
on an empty ledger and the reasoning about which class the brief can afford
converges. Execution inside the class differs — left-anchored against centred,
scrim at the top against lower-left — but the class does not.

This is probably correct rather than broken. Two people building the same
product with the same tool arriving at the same composition is consistency. The
failure being fixed was every project everywhere landing on one fold, and that
is gone: different briefs draw different classes, and the brief ledger stops a
project repeating itself on its next surface.

**Signature motifs still converge by brief type.** Both devtool runs produced a
floating delivery-proof card; both ceramics runs produced a maker's stamp
glyph. Composition is drawn; ornament is not. That is the next gap, and it is
smaller than the one this closed.

## Method note

Agents ran with no MCP server, so they used the documented fallback and read
`scripts/fold/classes.mjs` directly. The mechanism under test is the draw, not
the transport.

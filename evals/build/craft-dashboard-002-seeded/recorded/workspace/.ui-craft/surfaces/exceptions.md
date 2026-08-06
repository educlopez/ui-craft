# Surface — Reconciliation exceptions

**File:** `src/ReconciliationExceptions.jsx` · **Composition:** Command (operator work queue) · **Variance:** 4

## Layout
Sidebar 240px light tint → topbar 56px (title + run context, ⌘K search, export) → metric strip (hero: Open exceptions, accent tint + sparkline; 3 neutral supports) → status tabs + reason filter toggles → work queue table (dominant) → keyboard hint rail.

## Decisions
- Teal is the only chromatic colour (brief §5). Open-exception reasons are told apart by **neutral dot weight** (solid dark / ringed / mid-gray / hollow); teal dot marks cleared only. No red/green anywhere (learned constraint 2026-05-12).
- Differences and deltas: plain muted `tabular-nums` text, negatives in parentheses. No pills, no arrows.
- Signature bet: **keyboard-first queue** — j/k navigate, ↵ inspect, c clear; hints visible in table footer rail.
- Row inspect expands a bank-vs-ledger comparison panel; mismatched amount underlined, actions "Accept match" / "Clear as reviewed".
- Clearing is optimistic with a 6s Undo toast.
- States: loading skeleton mirrors final geometry; empty state distinguishes filters-empty vs queue-clear; error state names what failed and what still works.

## Edge cases
- "No ledger match" rows show the missing side explicitly, not a blank panel.
- Header checkbox goes indeterminate on partial selection; cleared rows are unselectable.
- Keyboard shortcuts suspended while an input has focus.

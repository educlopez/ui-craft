/**
 * coverage-data.mjs
 * UX coverage data: the parts a screen of a given kind needs in order to be complete.
 *
 * This is a DIFFERENT AXIS from acceptance-data.mjs. Acceptance items ask "is this
 * designed" (squint test, accent budget, no equal-weight card grid) — distinction.
 * Coverage items ask "does this screen have the parts screens of its kind need" —
 * completeness. The two are reported side by side and never merged into one number.
 *
 * Why never merged: score_ui already showed that hygiene-axis measures tie at the
 * top (61% of files at 100). Coverage is a hygiene axis. Folding it into a score
 * re-creates the tie and hides the distinction signal underneath it. Coverage is
 * also REPORT-ONLY — it never gates, never exits non-zero. The moment it gates,
 * `missing` reads as failure and `not-needed` stops reading as a legitimate design
 * call, which is the one thing the marker vocabulary exists to prevent.
 *
 * Item shape — all four parts are required, none ships alone:
 *   part   — the thing that should exist
 *   exists — what "present" concretely looks like (the coverage question)
 *   craft  — the ui-craft rule for HOW to build it, with its reference file
 *   cost   — what the user loses when it is absent (this is what makes a finding
 *            arguable instead of a preference)
 *
 * `exists` alone is a presence checklist, which any generic UX list already gives
 * you. `craft` alone is what the references already say. The pairing is the point.
 *
 * States are NOT duplicated here. references/state-design.md owns the state lattice
 * (idle/loading/empty/error/partial/success/conflict/offline) and the `state-coverage`
 * loop preset already evaluates it. Each archetype declares only which INSTANCES of
 * that lattice are non-obvious for it — a data table's filtered-empty is a different
 * screen from its first-run-empty, and that distinction is archetype knowledge, not
 * lattice knowledge.
 *
 * ESM module (not JSON) so it inlines into the published bundle and loads from source
 * on every Node version without import attributes. Edit here; this is the source of truth.
 */

export default {
  _note:
    'Hand-authored from references/forms.md, state-design.md, components.md, dashboard.md, ' +
    'accessibility.md, copy.md and recipe-auth.md. Report-only: no score, no percentage, no gate. ' +
    'Regen-on-reference-edit: update manually when those files change (v1 — no generator).',

  archetypes: {
    // ─── Web app ─────────────────────────────────────────────────────────────

    'data-table': {
      label: 'Data table',
      family: 'web-app',
      also: ['table', 'grid', 'list view', 'records', 'rows', 'datagrid', 'spreadsheet view'],
      states: [
        'filtered-empty — a query matched nothing; needs "clear filters", not an onboarding CTA',
        'first-run-empty — the account has no records at all; needs the onboarding CTA',
        'partial — one column sources from a failing service; per-cell error, not a page error',
      ],
      items: [
        {
          id: 'table-01',
          part: 'Sort, with the current direction visible',
          exists: 'Clickable column headers that toggle asc/desc, and an indicator showing which column is sorted and which way',
          craft: 'Headers sentence case, weight 500, secondary color — never uppercase (dashboard.md, Data Tables)',
          cost: 'The user re-clicks a header to find out which way it was already sorted, and loses their place',
          category: 'navigation',
        },
        {
          id: 'table-02',
          part: 'Row selection with a bulk action bar',
          exists: 'A checkbox column plus a bar that appears on selection, naming the count ("3 selected") and the available verbs',
          craft: 'Persistent bar, not a toast that times out. Verbs are ghost buttons — a toolbar never holds a solid primary (dashboard.md, Filter & Toolbar)',
          cost: 'The user selects forty rows and then hunts for the verb, or loses the selection to a timeout',
          category: 'action',
        },
        {
          id: 'table-03',
          part: 'Active filters legible without opening the filter panel',
          exists: 'Filter controls, and the currently-applied filters shown as chips or equivalent above the table with individual remove',
          craft: 'Ghost buttons; active state is accent background at low opacity. "Reset filters" appears only when filters are active, as a text link (dashboard.md, Filter & Toolbar)',
          cost: 'The user reads a filtered subset as the entire dataset and makes a decision on it',
          category: 'transparency',
        },
        {
          id: 'table-04',
          part: 'Pagination or virtualization, with the total count',
          exists: 'Page controls or a virtual window, plus a count that gives the scale ("1–50 of 1,240") and a rows-per-page choice',
          craft: 'Virtualize past 200 rows; paginate instead when the table must be find-in-page-searchable or printable, because a virtual window hides rows from Cmd+F (dashboard.md, Data Tables)',
          cost: 'The user has no sense of how much data exists, and a long table blows the frame budget on every scroll',
          category: 'transparency',
        },
        {
          id: 'table-05',
          part: 'Row-level actions, capped',
          exists: 'Two or three contextual actions reachable per row, with anything further in an overflow menu',
          craft: 'Icon-only controls need aria-label plus tooltip as the floor, but a visible text label beats both (components.md, Icon Labels)',
          cost: 'A row of undifferentiated icons is unscannable, and each one costs a hover to identify',
          category: 'action',
        },
        {
          id: 'table-06',
          part: 'Column visibility and density control, persisted',
          exists: 'A way to hide/show columns (and set row density), remembered across sessions',
          craft: 'Past ~5 options this stops being a dropdown and wants a searchable popover (components.md, Menus & Dropdowns)',
          cost: 'Power users rebuild their view on every visit — the most consistent complaint tables get',
          category: 'transparency',
        },
        {
          id: 'table-07',
          part: 'Both empty states, told apart',
          exists: 'A filtered-empty state offering to clear filters, and a first-run-empty state offering to create the first record — different copy, different CTA',
          craft: 'Filtered-empty gets a clear-filters button; first-run-empty gets the heavy onboarding CTA plus a visual (state-design.md, Empty States)',
          cost: 'A filtered-empty screen telling the user to create their first record, when they have 4,000 — reads as broken',
          category: 'state',
        },
        {
          id: 'table-08',
          part: 'Export that states its own scope',
          exists: 'A download action, labelled with what it will actually export given the current filter and selection',
          craft: 'Say the scope in the control itself ("Export 24 filtered rows"), matching copy.md restraint — not a bare "Export"',
          cost: 'The user expects the 24 rows on screen and receives 10,000, or the reverse',
          category: 'transparency',
        },
      ],
    },

    settings: {
      label: 'Settings',
      family: 'web-app',
      also: ['preferences', 'account settings', 'workspace settings', 'configuration', 'profile settings'],
      states: [
        'dirty — a field changed and is not yet persisted; the save model has to be visible in this state',
        'conflict — another tab or teammate changed the same setting (state-design.md, Conflict)',
      ],
      items: [
        {
          id: 'settings-01',
          part: 'Sections with a navigable index',
          exists: 'Grouped sections plus a sidebar or tab rail that jumps between them, with the current section marked',
          craft: 'Active item marked visibly and with aria-current; muted text that brightens on hover (dashboard.md, Sidebar navigation)',
          cost: 'The user scrolls a wall of controls hunting for one toggle',
          category: 'navigation',
        },
        {
          id: 'settings-02',
          part: 'A declared save model',
          exists: 'Either autosave with a visible saved-state indicator, or an explicit save button with a dirty state — stated, not guessed',
          craft: 'Toggle applies immediately; checkbox applies on submit — the control type is the promise (forms.md, Field Layout). Autosave debounces 1–2s and shows a timestamp, never a spinner (forms.md, Autosave)',
          cost: 'The user changes a setting, navigates away, and cannot tell whether it took',
          category: 'feedback',
        },
        {
          id: 'settings-03',
          part: 'Danger zone, separated',
          exists: 'Destructive settings (delete account, delete workspace, transfer ownership) in a visually distinct block at the bottom',
          craft: 'Never primary-button-style for the destructive action; Cancel is the primary. Prominence belongs to actions you want repeated (forms.md, Destructive Actions Inside Forms)',
          cost: 'An irreversible action sits at the same visual weight as changing a display name',
          category: 'safety',
        },
        {
          id: 'settings-04',
          part: 'Type-to-confirm on irreversible deletes',
          exists: 'The user types the resource name (or ticks an explicit acknowledgment) before the destructive button activates',
          craft: 'Friction proportional to blast radius — a misclick must not be able to complete the flow (components.md, Destructive actions)',
          cost: 'An account, and everything in it, is gone on a mis-aimed double-click',
          category: 'safety',
        },
        {
          id: 'settings-05',
          part: 'Each setting explains what it does',
          exists: 'A line of help text per non-obvious control, saying what changes when it is on',
          craft: 'Hints go ABOVE the control, errors below — hints are needed while deciding, and below the field they are covered by autofill menus and the mobile keyboard (forms.md, Error Placement)',
          cost: 'The user toggles something whose effect they cannot predict, then toggles it back',
          category: 'transparency',
        },
        {
          id: 'settings-06',
          part: 'Unsaved-changes guard',
          exists: 'Navigating away or closing with a dirty form prompts before discarding',
          craft: 'Escape closes the modal and prompts "Discard changes?" when dirty (forms.md, Keyboard Affordances)',
          cost: 'A filled form is lost silently to a mis-click on the sidebar',
          category: 'recovery',
        },
        {
          id: 'settings-07',
          part: 'Masked values are still identifiable',
          exists: 'API keys, tokens and connected accounts show enough to identify which one is installed (last 4, label, created date) plus a copy action',
          craft: 'Never block paste on these fields (accessibility.md). Copy is an explicit action, not a click-anywhere surprise',
          cost: 'The user cannot tell which of three keys is the live one, and rotates the wrong one',
          category: 'transparency',
        },
        {
          id: 'settings-08',
          part: 'A way back to defaults',
          exists: 'Reset-to-default available per section, shown only where something has been changed',
          craft: 'Text link, not a button, and absent when nothing is changed — the same discipline as "Reset filters" (dashboard.md, Filter & Toolbar)',
          cost: 'After experimenting, the user has no route back to a known-good configuration',
          category: 'recovery',
        },
      ],
    },

    'search-filter': {
      label: 'Search and filtering',
      family: 'web-app',
      also: ['search', 'filtering', 'faceted search', 'query', 'find', 'search results'],
      states: [
        'no-results — a fork, not a wall (components.md, Search)',
        'searching — must look different from no-results, or the two read as the same screen',
      ],
      items: [
        {
          id: 'search-01',
          part: 'A no-results state that offers a way forward',
          exists: 'Spelling-adjacent alternatives, popular or recent queries, or a scoped-search escape ("search all workspaces instead")',
          craft: 'Design it like any other empty state — explanation plus next action plus a visual (components.md, Search; state-design.md, Empty States)',
          cost: 'A bare "No results found" ends the session — it is the highest-intent moment on the surface and it dead-ends',
          category: 'state',
        },
        {
          id: 'search-02',
          part: 'Active filters visible outside the filter panel',
          exists: 'Applied filters shown as chips over the results, each individually removable, plus clear-all',
          craft: 'Every selected option visibly marked plus a one-step clear-all (components.md, Menus & Dropdowns)',
          cost: 'The user closes the filter panel, forgets a facet is set, and reads a subset as the whole',
          category: 'transparency',
        },
        {
          id: 'search-03',
          part: 'Result count, and what it counts',
          exists: 'A count that names the unit and reflects the active scope and filters',
          craft: 'font-variant-numeric: tabular-nums so the number does not jitter as results update (dashboard.md, Metric cards)',
          cost: 'The user cannot tell a working query returning little from a broken query returning nothing',
          category: 'feedback',
        },
        {
          id: 'search-04',
          part: 'Query and filters in the URL',
          exists: 'The full result state is encoded in the address, so it survives reload, back, and paste into Slack',
          craft: '—',
          cost: 'A result set cannot be shared or returned to; the back button silently drops the query',
          category: 'navigation',
        },
        {
          id: 'search-05',
          part: 'Recent or saved searches, on revisit-heavy products',
          exists: 'Previous queries offered on focus, each individually removable, with clear-all',
          craft: 'Individual remove plus clear-all when the product is revisit-heavy (components.md, Search)',
          cost: 'The user retypes the same query every morning',
          category: 'action',
        },
        {
          id: 'search-06',
          part: 'Loading distinguishable from empty',
          exists: 'A searching state that does not look like the no-results state',
          craft: 'Skeleton matching the result layout, shown after 200ms — not a spinner on a blank panel (state-design.md, Loading States)',
          cost: 'The user reads "still searching" as "nothing found" and abandons before results arrive',
          category: 'state',
        },
        {
          id: 'search-07',
          part: 'Scope stated when search is scoped',
          exists: 'The input or its surroundings say what is being searched, and offer to widen',
          craft: 'Placeholder shows the content types ("Search projects, people, docs…"), not the word "Search" the icon already says (components.md, Search)',
          cost: 'The user concludes a record does not exist when they only searched one project',
          category: 'transparency',
        },
      ],
    },

    'detail-view': {
      label: 'Detail / record view',
      family: 'web-app',
      also: ['record page', 'detail page', 'item view', 'entity page', 'show page', 'drill-in'],
      states: [
        'not-found vs no-permission — different causes, different copy (state-design.md, Network errors)',
        'stale — the record changed under the user while open',
      ],
      items: [
        {
          id: 'detail-01',
          part: 'A way back that preserves the list',
          exists: 'Breadcrumb or back control returning to the originating list with its filters, sort and page intact',
          craft: 'Recovery conventions are load-bearing — the logo-links-home rule exists for the same reason (components.md, Navigation)',
          cost: 'Back lands on an unfiltered, unsorted, page-one list and the user rebuilds their context every time',
          category: 'navigation',
        },
        {
          id: 'detail-02',
          part: 'The record identifies itself, including in the tab title',
          exists: 'The record name in the page heading and in document.title',
          craft: 'Sentence case; the heading says what this is, not what the section is called (SKILL.md, sentence case default)',
          cost: 'Six open tabs all read the same and the user closes the wrong one',
          category: 'navigation',
        },
        {
          id: 'detail-03',
          part: 'One primary action, distinct from the record metadata',
          exists: 'The action the page exists for is visually separated from the field values around it',
          craft: 'One primary per context — two solid CTAs is a tie, and ties stall (components.md, Tiers)',
          cost: 'The user scans the record for the verb and finds it below the fold, or not at all',
          category: 'action',
        },
        {
          id: 'detail-04',
          part: 'The edit affordance declares its mode',
          exists: 'It is evident whether editing happens inline, in a modal, or on a separate route — and whether the user is currently editing',
          craft: 'If putting the task in a modal adds steps versus doing it in-flow, it does not belong in a modal (components.md, Modals)',
          cost: 'The user types into what they think is an editor and loses it, or edits a value believing it saved',
          category: 'action',
        },
        {
          id: 'detail-05',
          part: 'History or activity, where the record is shared',
          exists: 'Who changed what, when — at least for the fields that matter',
          craft: 'Status as a 6–8px dot inline with text, never a badge/pill (dashboard.md, Data Tables)',
          cost: 'No answer to "who changed this and when", which is the first question asked when something is wrong',
          category: 'transparency',
        },
        {
          id: 'detail-06',
          part: 'Adjacent-record navigation, on list-driven surfaces',
          exists: 'Previous/next through the list the user arrived from, with position ("4 of 32")',
          craft: 'Icon right of the label signals destination (components.md, Buttons)',
          cost: 'Reviewing thirty records means thirty round-trips through the list',
          category: 'navigation',
        },
        {
          id: 'detail-07',
          part: 'Not-found separated from no-permission',
          exists: 'A deleted record and a record the user may not see produce different screens with different next actions',
          craft: 'Distinguish offline from 500 from 403 — different causes, different fixes (state-design.md, Network errors)',
          cost: 'A permissions problem reads as a deleted record and gets reported as data loss',
          category: 'state',
        },
      ],
    },

    'empty-first-run': {
      label: 'First-run / empty product',
      family: 'web-app',
      also: ['empty state', 'zero state', 'blank slate', 'first use', 'new account', 'no data'],
      states: [
        'first-run vs filtered vs cleared — three different empties with three different CTAs (state-design.md, Empty state types)',
      ],
      items: [
        {
          id: 'firstrun-01',
          part: 'It says why it is empty',
          exists: 'Copy naming the reason in the user\'s terms',
          craft: '"You haven\'t created any projects yet" beats "No data" (state-design.md, Empty States)',
          cost: 'An unexplained empty screen reads as a failed load, and the user reloads instead of acting',
          category: 'state',
        },
        {
          id: 'firstrun-02',
          part: 'One next action, primary',
          exists: 'A CTA that populates the state, sized as the page\'s main action',
          craft: 'First-run empty gets the heavy CTA; every empty state is a call to onboard (state-design.md, Empty state types)',
          cost: 'A dead end at the moment of highest intent — the user just signed up and has nothing to do',
          category: 'action',
        },
        {
          id: 'firstrun-03',
          part: 'A visual, even a small one',
          exists: 'An illustration or at minimum a subtle icon anchoring the block',
          craft: 'Prevents the "this page is broken" read (state-design.md, Empty States)',
          cost: 'Text alone on a blank panel is indistinguishable from a render failure',
          category: 'state',
        },
        {
          id: 'firstrun-04',
          part: 'A path that does not require building from nothing',
          exists: 'Sample data, a template, an import, or a demo workspace',
          craft: '—',
          cost: 'The user has to imagine the populated state before committing effort to reach it',
          category: 'action',
        },
        {
          id: 'firstrun-05',
          part: 'Told apart from filtered-empty and cleared-empty',
          exists: 'The three empties do not share one component with one CTA',
          craft: 'Filtered → "try removing filters" plus a clear button. Cleared → celebratory or contextual, may need no CTA at all (state-design.md, Empty state types)',
          cost: 'The wrong CTA for the situation, which reads as the product not knowing what the user did',
          category: 'state',
        },
        {
          id: 'firstrun-06',
          part: 'A secondary route that does not compete',
          exists: 'Learn-more or docs available, clearly subordinate to the primary CTA',
          craft: 'Tertiary is text plus underline — the underline is the colour-blind affordance, not decoration (components.md, Tiers)',
          cost: 'Two equal CTAs on an empty screen is a tie at the exact moment the user needs to be told what to do',
          category: 'action',
        },
      ],
    },

    billing: {
      label: 'Billing / subscription',
      family: 'web-app',
      also: ['subscription', 'plan management', 'invoices', 'payment settings', 'usage and limits'],
      states: [
        'past-due — the account is failing to charge; distinct from cancelled',
        'over-limit — a metered plan exceeded its allowance',
      ],
      items: [
        {
          id: 'billing-01',
          part: 'The current plan, stated',
          exists: 'Plan name, what it includes, and the seat or unit count it is billed on',
          craft: 'Amounts use tabular-nums so figures align down the column (dashboard.md, Metric cards)',
          cost: 'The user cannot tell what they are paying for, which is the first question in every billing support ticket',
          category: 'transparency',
        },
        {
          id: 'billing-02',
          part: 'Usage against the limit, on metered plans',
          exists: 'Current consumption shown against the allowance, not as a bare number',
          craft: 'A two-segment donut with a centre label is acceptable for a binary proportion — used vs remaining is the one case with a single comparison (dashboard.md, Chart Type Decision Matrix)',
          cost: 'The first signal of an overage is the invoice',
          category: 'transparency',
        },
        {
          id: 'billing-03',
          part: 'Next charge: date and amount',
          exists: 'Both, before it happens',
          craft: 'Currency via Intl.NumberFormat, symbol as a prefix affordance (forms.md, Field-Specific Patterns)',
          cost: 'A charge the user did not anticipate, which is a chargeback and a cancellation in one',
          category: 'transparency',
        },
        {
          id: 'billing-04',
          part: 'Payment method, identifiable and replaceable',
          exists: 'Brand and last four, plus a route to update it that does not require contacting anyone',
          craft: 'Card entry autoformats in groups of four, detects brand from the leading digits, and moves focus to expiry when the number completes (forms.md, Field-Specific Patterns)',
          cost: 'An expired card fails the renewal silently and the account lapses',
          category: 'recovery',
        },
        {
          id: 'billing-05',
          part: 'Invoice history, downloadable',
          exists: 'Past invoices listed and retrievable without a support request',
          craft: 'The download control states what it produces, the same discipline as a table export (dashboard.md)',
          cost: 'Finance chases support every month for a document the product already has',
          category: 'action',
        },
        {
          id: 'billing-06',
          part: 'Plan change shows the proration before confirming',
          exists: 'What will be charged or credited today, stated before the confirm, not after',
          craft: 'This is the review step from the multi-step contract: summary before commit, with a route back to change it (forms.md, Multi-Step)',
          cost: 'The user is billed an amount they never saw, on an action they chose',
          category: 'safety',
        },
        {
          id: 'billing-07',
          part: 'A cancel path that exists and is honest',
          exists: 'Self-serve cancellation, stating what happens to data and when access ends',
          craft: 'Confirmshaming is banned (copy.md, Dark UX). Friction proportional to blast radius, not to revenue (components.md, Destructive actions)',
          cost: 'Cancellation only by support ticket is a trust failure that outlives the subscription',
          category: 'safety',
        },
      ],
    },

    // ─── Website ─────────────────────────────────────────────────────────────

    pricing: {
      label: 'Pricing page',
      family: 'website',
      also: ['plans', 'pricing table', 'tiers', 'plan comparison', 'packages'],
      states: [
        'annual/monthly toggle — the same page in two configurations, both of which have to read correctly',
      ],
      items: [
        {
          id: 'pricing-01',
          part: 'One plan differentiated as the recommended path',
          exists: 'A visually distinguished tier, not four identical columns',
          craft: 'A uniform grid of equal-weight cards is the single most recognisable template shape, and it fails the squint test — the eye has nowhere to land (dashboard.md, Signal-to-Noise Hierarchy)',
          cost: 'The user has to do the product\'s job of deciding which plan is for them, and leaves instead',
          category: 'action',
        },
        {
          id: 'pricing-02',
          part: 'Tiers comparable line for line',
          exists: 'The same feature rows in the same order across plans, so difference is readable by scanning across',
          craft: 'Shared min-height per row, identical structure per card — mixed heights in one grid read as unfinished (components.md, Cards)',
          cost: 'The user cannot answer "what do I get for the extra £20" without opening two tabs',
          category: 'transparency',
        },
        {
          id: 'pricing-03',
          part: 'Billing period control, with the saving stated',
          exists: 'Monthly/annual switch that says what annual saves, in the control or beside it',
          craft: 'Two options is a segmented control, not a dropdown (forms.md, Field Layout). A toggle applies immediately — prices update on switch, no submit',
          cost: 'The annual discount, which is the page\'s main commercial lever, is invisible',
          category: 'transparency',
        },
        {
          id: 'pricing-04',
          part: 'Price transparency: per what, per whom, in what currency',
          exists: 'Unit, period, and currency explicit on every price',
          craft: 'Intl.NumberFormat per locale; the currency symbol is a rendered prefix, never typed (forms.md, Field-Specific Patterns)',
          cost: 'The user computes the real monthly cost themselves and assumes the worst reading',
          category: 'transparency',
        },
        {
          id: 'pricing-05',
          part: 'Trial or free-tier terms, including whether a card is required',
          exists: 'Stated at the CTA, before the click',
          craft: 'State what happens next under the CTA — the same rule as the sign-up submit (recipe-auth.md, Sign-up deltas)',
          cost: 'Abandonment at the card field, after the user already committed to trying',
          category: 'transparency',
        },
        {
          id: 'pricing-06',
          part: 'A route for the case not on the page',
          exists: 'Enterprise, custom, or contact path for buyers the tiers do not fit',
          craft: 'One CTA in the nav, distinct from the page primary — three levels that must not tie (components.md, Navigation)',
          cost: 'The largest deals have no route and self-select out',
          category: 'action',
        },
        {
          id: 'pricing-07',
          part: 'Objection handling next to the decision',
          exists: 'FAQ, guarantee, or security/compliance answers on the page, not one click away',
          craft: 'Objections resolve last, so this sits immediately before the closing CTA',
          cost: 'The unanswered objection is what the user leaves to research and does not come back from',
          category: 'transparency',
        },
      ],
    },

    'docs-page': {
      label: 'Documentation page',
      family: 'website',
      also: ['docs', 'documentation', 'guide', 'reference page', 'api docs', 'help article'],
      states: [
        'deep-link arrival — most readers land mid-tree from search, never through the index',
      ],
      items: [
        {
          id: 'docs-01',
          part: 'Where-am-I is answerable at a glance',
          exists: 'Breadcrumb plus the active item marked in the navigation tree',
          craft: 'Active page visibly marked, aria-current on it (components.md, Navigation)',
          cost: 'A reader arriving from search has no map, and cannot tell what this page is part of',
          category: 'navigation',
        },
        {
          id: 'docs-02',
          part: 'On-page outline',
          exists: 'The page\'s headings listed and linked, tracking the reading position on long pages',
          craft: 'Depth-2 headings only, built from the document rather than maintained beside it — a hand-kept outline goes stale',
          cost: 'A long page is unscannable, and the reader cannot tell whether their answer is on it',
          category: 'navigation',
        },
        {
          id: 'docs-03',
          part: 'Previous / next through the sequence',
          exists: 'Links to the adjacent pages in the intended reading order, named',
          craft: 'Icon right of the label signals destination (components.md, Buttons)',
          cost: 'The reader returns to the index between every page, and loses the thread of a tutorial',
          category: 'navigation',
        },
        {
          id: 'docs-04',
          part: 'Code blocks that are copyable and labelled',
          exists: 'A copy control per block, the language marked, and horizontal overflow contained',
          craft: 'Never block paste (accessibility.md). Wrap in overflow-x: auto with scrollbar-gutter: stable so the block does not shift on scroll (dashboard.md, Data Tables)',
          cost: 'Hand-retyping a command introduces the typo the reader then debugs instead of the product',
          category: 'action',
        },
        {
          id: 'docs-05',
          part: 'Which version this applies to',
          exists: 'A version or applies-to marker where the product versions',
          craft: '—',
          cost: 'The reader follows instructions for a release they are not running, and blames the product',
          category: 'transparency',
        },
        {
          id: 'docs-06',
          part: 'Search scoped to the docs',
          exists: 'An input that searches the documentation, with results that show where each hit lives',
          craft: 'Placeholder shows the content type, not the word "Search" the icon already says (components.md, Search)',
          cost: 'The reader leaves for a general search engine and lands on a competitor or a stale copy',
          category: 'navigation',
        },
        {
          id: 'docs-07',
          part: 'Freshness and a way to report a problem',
          exists: 'Last-updated date, plus an edit or feedback route',
          craft: 'Quiet tertiary typography — present, not competing with the content',
          cost: 'No signal whether the page is current, so every instruction is read with suspicion',
          category: 'transparency',
        },
      ],
    },

    // ─── Flows ───────────────────────────────────────────────────────────────

    checkout: {
      label: 'Checkout / payment',
      family: 'flows',
      also: ['payment flow', 'purchase', 'cart checkout', 'pay', 'order flow'],
      states: [
        'declined — the charge failed; the cart and every entered field must survive it',
        'processing — non-optimistic, so this state is real and has to be designed',
      ],
      items: [
        {
          id: 'checkout-01',
          part: 'The order stays visible throughout',
          exists: 'A summary of what is being bought, present at every step, not only at the end',
          craft: '—',
          cost: 'The user loses track of what they are paying for and re-opens the cart to check, dropping out of the flow',
          category: 'transparency',
        },
        {
          id: 'checkout-02',
          part: 'The complete total before the payment step',
          exists: 'Tax, shipping and fees resolved and shown before the user enters card details',
          craft: 'State the cost upfront — the multi-step contract\'s first rule (forms.md, Multi-Step)',
          cost: 'A total that grows at the last step is the single largest cause of checkout abandonment',
          category: 'transparency',
        },
        {
          id: 'checkout-03',
          part: 'Progress with a labelled step count',
          exists: 'Current step, total steps, and what this step is',
          craft: '"Step 3 of 5: Payment", not "Step 3 of 5" — the label is what makes the count useful (forms.md, Multi-Step)',
          cost: 'Unknown remaining length is why users abandon at step two',
          category: 'feedback',
        },
        {
          id: 'checkout-04',
          part: 'Guest checkout, or a stated reason for the account',
          exists: 'Either purchase without an account, or an explicit reason why one is required',
          craft: 'Ask the minimum; enrich the profile later, in-product (recipe-auth.md, Sign-up deltas)',
          cost: 'A forced signup at the point of purchase intent, which is the worst possible moment to add a form',
          category: 'action',
        },
        {
          id: 'checkout-05',
          part: 'The card fields assist rather than test',
          exists: 'Autoformatting, brand detection, automatic focus advance, and expiry/CVC paired',
          craft: 'Space every four digits, detect brand from leading digits, move focus to expiry when the number validates. MM/YY plus CVC side by side is the one exception to single-column (forms.md, Field Layout and Field-Specific Patterns)',
          cost: 'The most error-prone field in the product is also the least assisted, and each error costs a retry at peak anxiety',
          category: 'input',
        },
        {
          id: 'checkout-06',
          part: 'A review step before the charge',
          exists: 'Everything entered, grouped by section, with a per-section edit that returns here',
          craft: 'Edit jumps back to that step and comes back — users catch their own errors more cheaply than servers do (forms.md, Multi-Step)',
          cost: 'A wrong address or quantity becomes a refund, a return, and a support conversation',
          category: 'safety',
        },
        {
          id: 'checkout-07',
          part: 'The submit waits for the server',
          exists: 'No optimistic success on the charge, and no possible double-submit',
          craft: 'Payments and high-stakes writes always wait for confirmation. Disable the button AND swap its label to "Processing…" with the spinner inside — belt and braces (forms.md, Optimistic Submit)',
          cost: 'A double charge, which costs more trust than the sale was worth',
          category: 'safety',
        },
        {
          id: 'checkout-08',
          part: 'Failure keeps the cart and the typed data',
          exists: 'A declined card returns to the payment step with everything else intact and the reason stated',
          craft: 'Keep the in-flight state — never throw away the form the user just filled (state-design.md, Network errors)',
          cost: 'A declined card that empties the basket converts a retry into a lost sale',
          category: 'recovery',
        },
      ],
    },

    onboarding: {
      label: 'Onboarding flow',
      family: 'flows',
      also: ['setup flow', 'getting started', 'welcome flow', 'activation', 'first-time setup', 'wizard'],
      states: [
        'resumed — the user left and came back; the flow must restart where they stopped, not at step 1',
      ],
      items: [
        {
          id: 'onboarding-01',
          part: 'The cost is stated before step one',
          exists: 'How many steps, roughly how long, and anything the user needs to hand',
          craft: '"3 steps, about 2 minutes, you\'ll need your ID" — before step 1 (forms.md, Multi-Step)',
          cost: 'Unknown length is the reason users abandon at step two, having already invested in step one',
          category: 'transparency',
        },
        {
          id: 'onboarding-02',
          part: 'Steps ordered easy to hard',
          exists: 'Cheap questions first, the expensive ask last',
          craft: 'Name and email before payment details — early wins build completion momentum (forms.md, Multi-Step)',
          cost: 'Opening with the hardest ask maximises abandonment before any investment exists to protect',
          category: 'action',
        },
        {
          id: 'onboarding-03',
          part: 'Optional steps marked and genuinely skippable',
          exists: 'A visible skip on any step that is not required, that actually completes the flow',
          craft: 'Tertiary text plus underline — findable without competing with the primary (components.md, Tiers)',
          cost: 'The user quits the product rather than answer a question they could have skipped',
          category: 'action',
        },
        {
          id: 'onboarding-04',
          part: 'Progress, and resume on return',
          exists: 'Step position shown, and returning restores the last completed step',
          craft: 'Restore to the last completed step, not step 1. Save the draft automatically between steps (forms.md, Multi-Step and Autosave)',
          cost: 'A user who is interrupted restarts from zero, and the second abandonment is permanent',
          category: 'recovery',
        },
        {
          id: 'onboarding-05',
          part: 'Five steps at most',
          exists: 'The flow fits inside the number of stages a user can hold',
          craft: 'Miller\'s Law — beyond five the user loses the map (heuristics.md; forms.md, Multi-Step)',
          cost: 'A flow whose end the user cannot see is one they stop believing in',
          category: 'action',
        },
        {
          id: 'onboarding-06',
          part: 'A first real result inside the flow',
          exists: 'The user reaches something that is theirs — a populated workspace, a first record, a working connection — before the flow ends',
          craft: 'Every empty state is a call to onboard; this is the same contract run forwards (state-design.md, Empty States)',
          cost: 'The user completes setup and arrives at an empty product, which is the same dead end onboarding existed to avoid',
          category: 'action',
        },
        {
          id: 'onboarding-07',
          part: 'Back that preserves everything',
          exists: 'Moving back keeps all entered state, on every step',
          craft: 'Never re-fetch or reset on back (forms.md, Multi-Step)',
          cost: 'Correcting one typo costs the whole step, so users push through with wrong data instead',
          category: 'recovery',
        },
      ],
    },

    'destructive-confirm': {
      label: 'Destructive confirmation',
      family: 'flows',
      also: ['delete confirmation', 'are you sure', 'confirm dialog', 'remove', 'danger action'],
      states: [
        'undo window — for recoverable actions the confirm should not exist at all; the undo is the design',
      ],
      items: [
        {
          id: 'destructive-01',
          part: 'Friction matched to blast radius',
          exists: 'Recoverable actions act immediately with undo; irreversible ones require explicit acknowledgment',
          craft: 'Low — act plus undo toast. Medium — dialog with verb buttons and the items named. High — type the resource name or tick a box before the destructive button activates (components.md, Destructive actions)',
          cost: 'A confirm on an undoable action trains the user to click through; no confirm on an irreversible one is data loss',
          category: 'safety',
        },
        {
          id: 'destructive-02',
          part: 'The affected thing is named and counted',
          exists: 'The dialog says exactly what will be deleted, by name and by number',
          craft: 'The affected items are named and highlighted, not summarised as "items" (components.md, Destructive actions)',
          cost: '"Delete items?" gives the user nothing to check their intent against',
          category: 'safety',
        },
        {
          id: 'destructive-03',
          part: 'Verb buttons, never Yes/No',
          exists: 'The confirming button restates the action',
          craft: '"Delete project" / "Cancel". Yes/No forces re-reading the question, and a negatively-phrased question plus Yes/No produces wrong clicks under time pressure (components.md, Modals)',
          cost: 'A wrong click on an irreversible action, caused by the button labels alone',
          category: 'safety',
        },
        {
          id: 'destructive-04',
          part: 'Consequence and reversibility stated',
          exists: 'What else this removes, and whether it can be undone — and for how long',
          craft: 'Copy tone per copy.md; no confirmshaming in the cancel path (copy.md, Dark UX)',
          cost: 'The user cannot calibrate the decision, so they either stall or delete something with dependents',
          category: 'transparency',
        },
        {
          id: 'destructive-05',
          part: 'Three ways out',
          exists: 'Visible close, explicit cancel, and overlay click — plus Escape',
          craft: 'All of them, always, with the focus trap rules from accessibility.md (components.md, Modals)',
          cost: 'A user who wants out of a delete dialog and cannot find the exit is one keystroke from confirming it',
          category: 'recovery',
        },
        {
          id: 'destructive-06',
          part: 'Undo where the action is recoverable',
          exists: 'A time-boxed undo after the fact, instead of a confirm before it',
          craft: 'Act immediately plus undo toast — friction before a recoverable action is rude (components.md, Destructive actions)',
          cost: 'Friction is spent in the wrong place: the common case pays for the rare one',
          category: 'recovery',
        },
      ],
    },

    'invite-share': {
      label: 'Invite / share',
      family: 'flows',
      also: ['invite members', 'share', 'collaborators', 'permissions', 'add teammate', 'sharing dialog'],
      states: [
        'partial-send — some invites delivered, some rejected; per-recipient, never per-batch (state-design.md, Partial)',
      ],
      items: [
        {
          id: 'invite-01',
          part: 'Role chosen at invite time, with each role explained',
          exists: 'A role selector alongside the recipient, saying what each role can do',
          craft: 'Two to five options is radios or a segmented control, stacked vertically — not a dropdown (forms.md, Field Layout)',
          cost: 'Everyone gets the default role, which is either admin (a security problem) or read-only (a support ticket)',
          category: 'safety',
        },
        {
          id: 'invite-02',
          part: 'More than one invitee per pass',
          exists: 'Several addresses entered or pasted at once',
          craft: 'Never block paste — a pasted list is the whole point (accessibility.md)',
          cost: 'Onboarding a team of ten means ten identical round-trips',
          category: 'input',
        },
        {
          id: 'invite-03',
          part: 'Pending invites visible and revocable',
          exists: 'A list of who has been invited but not joined, with revoke',
          craft: 'Status as a 6–8px dot inline with the text, not a badge or pill (dashboard.md, Data Tables)',
          cost: 'No record of outstanding invitations, so an ex-contractor\'s invite stays live indefinitely',
          category: 'safety',
        },
        {
          id: 'invite-04',
          part: 'Copy-link alternative that states its scope',
          exists: 'A shareable link, with what it grants and to whom said before the copy action',
          craft: 'Decoration must never impersonate function — a link that grants access looks and reads like one (components.md, Text Links)',
          cost: 'A link that grants more than the user believed, pasted into a channel they thought was private',
          category: 'safety',
        },
        {
          id: 'invite-05',
          part: 'Confirmation of what was sent, to whom',
          exists: 'A success state naming the recipients',
          craft: 'Success is visual and textual, and does not vanish in a second (state-design.md, State Lattice)',
          cost: 'The user cannot tell whether it worked and invites the same people again',
          category: 'feedback',
        },
        {
          id: 'invite-06',
          part: 'Failures reported per recipient',
          exists: 'One bad address fails only itself, with a retry on that row',
          craft: 'Show what succeeded, mark what failed per item, retry the failing piece without redoing the rest (state-design.md, Partial)',
          cost: 'One typo silently fails nine valid invitations, and nobody finds out until the meeting',
          category: 'recovery',
        },
        {
          id: 'invite-07',
          part: 'Resend with a visible cooldown',
          exists: 'A resend action that says when it becomes available again',
          craft: '"Didn\'t receive? Resend in 30s" with the countdown visible (forms.md, Field-Specific Patterns)',
          cost: 'The user hammers resend, the recipient gets six emails, and the provider throttles the domain',
          category: 'feedback',
        },
      ],
    },
  },
};

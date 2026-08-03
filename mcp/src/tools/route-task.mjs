/**
 * route-task.mjs
 * MCP tool: route_task
 *
 * Takes a natural-language prompt and returns the entries of the skill most likely to be
 * relevant, plus the single first move to make. Deterministic lexical ranking — no model
 * call, no embeddings, no network. Same input always yields the same output.
 *
 * WHY this exists: the routing table in SKILL.md only fires when the user's words happen to
 * match our filenames. Ask for "an analytics panel" and nothing points at
 * recipe-dashboard.md, because that file never says analytics. A synonym map fixes the
 * vocabulary mismatch that a table cannot.
 *
 * Data source: route-data.mjs (hand-maintained corpus + synonyms + stopwords).
 *
 * Boundary: returns POINTERS, never rules. The design judgment stays in the files this
 * points at — this tool does not summarise them, rank them by taste, or decide anything
 * about the UI itself.
 */

import { STOPWORDS, SYNONYMS, CORPUS, REPAIR_MARKERS } from '../route-data.mjs';

// ─── Signal ladder ───────────────────────────────────────────────────────────
// An exact name match wins. An exact keyword is next. Below those sit the near
// matches that forgive typos. A word that only appears in a summary still counts,
// but a clean name or keyword match always outranks it — so a prompt gets the real
// entry, not one that happened to mention the word once.

const SIGNAL = {
  NAME_EXACT: 100,
  KEYWORD_EXACT: 60,
  CONTAINS_EXACT: 45,
  NAME_FUZZY: 40,
  KEYWORD_FUZZY: 25,
  SUMMARY_WORD: 12,
};

// Coverage is an additive bonus, never a multiplier. A multiplier would scale a long
// prompt's score down by the fraction of words that missed, which punishes rambling —
// the exact failure this ranking is supposed to avoid. Additive lets coverage reward the
// entry that accounts for most of the prompt without penalising the verbose prompt.
const COVERAGE_BONUS = 25;

// Below this, a match is noise.
const SCORE_FLOOR = 20;

// An entry may only supply the first move if it scores within this fraction of the winner.
const RELEVANT_MOVE_RATIO = 0.6;
// A command outranks the top reference for the move when it comes this close to it.
const COMMAND_PREFERENCE_RATIO = 0.8;
const FUZZY_MIN_LENGTH = 5; // shorter tokens fuzz into unrelated words too easily
const FUZZY_MAX_DISTANCE = 2;

// ─── Reverse synonym index ───────────────────────────────────────────────────
// alias → concept ids. Built once at module load. One hop only: an alias resolves to
// its concept(s) and stops there, so adding an alias can never re-route a chain of
// unrelated concepts.

const ALIAS_TO_CONCEPTS = new Map();
for (const [concept, aliases] of Object.entries(SYNONYMS)) {
  const register = (word, target) => {
    const existing = ALIAS_TO_CONCEPTS.get(word);
    if (existing) {
      if (!existing.includes(target)) existing.push(target);
    } else {
      ALIAS_TO_CONCEPTS.set(word, [target]);
    }
  };
  register(concept, concept);
  for (const alias of aliases) register(alias, concept);
}

// ─── Normalisation ───────────────────────────────────────────────────────────

/** Strip accents so a word typed with diacritics matches the plain form in the index. */
function deaccent(word) {
  return word.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Ordered stemmer rules, so chart/charts/charting fold to one root. Deliberately not a
// real Porter stemmer: it only has to make our own corpus reachable.
//
// Deletions require at least MIN_STEM characters left over. That guard is not cosmetic:
// without it "states" strips to "stat" and collides with "stats", which quietly routed
// every dashboard prompt to the unhappy-path command. An aggressive stemmer creates false
// matches that are far harder to debug than a missed one.
const MIN_STEM = 5;
const STEM_RULES = [
  [/ing$/, ''],
  [/ies$/, 'y'],
  [/es$/, ''],
  [/s$/, ''],
];

export function stem(word) {
  for (const [pattern, replacement] of STEM_RULES) {
    if (!pattern.test(word)) continue;
    const next = word.replace(pattern, replacement);
    if (next.length >= MIN_STEM || next.length === word.length) return next;
  }
  return word;
}

/** Tokenise, drop stopwords and pure numbers, de-accent. Keeps internal hyphens. */
export function tokenize(prompt) {
  return String(prompt)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .map(deaccent)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

/** Levenshtein distance, abandoned as soon as it cannot come in under `max`. */
export function editDistance(a, b, max = FUZZY_MAX_DISTANCE) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

/**
 * Turn a prompt into concepts. Each surviving token becomes one concept carrying its
 * literal form, its stem, and every synonym-map word it reaches. Two tokens that resolve
 * to the same concept id collapse into one, so "dashboard analytics KPIs" counts once
 * instead of tripling the weight of a single idea.
 */
export function toConcepts(prompt) {
  const tokens = tokenize(prompt);
  const concepts = [];
  const seenKey = new Set();

  for (const token of tokens) {
    const stemmed = stem(token);
    const conceptIds = ALIAS_TO_CONCEPTS.get(token) ?? ALIAS_TO_CONCEPTS.get(stemmed) ?? [];
    const key = conceptIds.length ? `concept:${conceptIds.join('+')}` : `token:${stemmed}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);

    const words = new Set([token, stemmed]);
    for (const id of conceptIds) {
      words.add(id);
      for (const alias of SYNONYMS[id] ?? []) words.add(deaccent(alias));
    }
    concepts.push({ token, stem: stemmed, conceptIds, words: [...words] });
  }
  return concepts;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

/** Best signal this entry offers for one concept, walking the ladder top-down. */
function scoreConcept(entry, concept) {
  const name = deaccent(entry.name.toLowerCase());
  const nameStem = stem(name);
  const keywords = (entry.keywords ?? []).map((k) => deaccent(k.toLowerCase()));
  const contains = (entry.contains ?? []).map((c) => deaccent(c.toLowerCase()));
  const summaryWords = new Set(tokenize(entry.summary ?? '').map(stem));
  const conceptWords = concept.words;

  for (const w of conceptWords) {
    if (name === w || nameStem === stem(w)) return SIGNAL.NAME_EXACT;
  }
  for (const w of conceptWords) {
    if (keywords.includes(w) || keywords.some((k) => stem(k) === stem(w))) return SIGNAL.KEYWORD_EXACT;
  }
  for (const w of conceptWords) {
    if (contains.includes(w) || contains.some((c) => stem(c) === stem(w) || c.split('-').includes(w))) {
      return SIGNAL.CONTAINS_EXACT;
    }
  }
  // Fuzzy only against the literal token, never against expanded synonyms: fuzzing an
  // alias means two hops of approximation, which is where nonsense matches come from.
  if (concept.token.length >= FUZZY_MIN_LENGTH) {
    if (editDistance(concept.token, name) <= FUZZY_MAX_DISTANCE) return SIGNAL.NAME_FUZZY;
    if (keywords.some((k) => k.length >= FUZZY_MIN_LENGTH && editDistance(concept.token, k) <= FUZZY_MAX_DISTANCE)) {
      return SIGNAL.KEYWORD_FUZZY;
    }
  }
  for (const w of conceptWords) {
    if (summaryWords.has(stem(w))) return SIGNAL.SUMMARY_WORD;
  }
  return 0;
}

/**
 * Score one entry against every concept, then combine: strongest signal + coverage bonus.
 *
 * Strength is the entry's BEST claim, not the mean of its claims. The mean looked fairer and
 * was wrong: on "review keyboard accessibility", /audit matched both concepts (name 100 +
 * keyword 60) and averaged down to 80, losing to /critique, which matched one concept at 100
 * and covered half the prompt. Taking the max and paying for breadth separately means
 * covering a second concept can only ever help.
 *
 * Neither term is a multiplier, so a rambling prompt is never scaled down for the words that
 * missed.
 */
function scoreEntry(entry, concepts) {
  if (!concepts.length) return { score: 0, matched: [] };
  const perConcept = concepts.map((c) => ({ concept: c, signal: scoreConcept(entry, c) }));
  const matched = perConcept.filter((p) => p.signal > 0);
  if (!matched.length) return { score: 0, matched: [] };

  // One incidental summary word is not a match. Requiring two before a summary-only hit
  // counts keeps entries out of the results just because their description mentions a
  // word once — the failure mode where the ranking looks thorough and is actually noise.
  const strongest = Math.max(...matched.map((m) => m.signal));
  if (strongest <= SIGNAL.SUMMARY_WORD && matched.length < 2) return { score: 0, matched: [] };

  const coverage = matched.length / concepts.length;
  return {
    score: Math.round((strongest + coverage * COVERAGE_BONUS) * 10) / 10,
    matched: matched.map((m) => m.concept.token),
  };
}

// ─── Repair intent ───────────────────────────────────────────────────────────

const REPAIR_SET = new Set(REPAIR_MARKERS.map(deaccent));
// Constructive moves — the ones that make a new surface rather than change one.
const BUILD_MOVE = /^\/(craft|sddesign|shape)\b/;

/** True when the prompt says something already exists and is wrong. */
export function isRepairIntent(prompt) {
  return String(prompt)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .split(/\s+/)
    .map(deaccent)
    .some((w) => REPAIR_SET.has(w));
}

// ─── Tool ────────────────────────────────────────────────────────────────────

const KIND_LABEL = {
  command: 'command',
  reference: 'reference',
  mcp_tool: 'mcp_tool',
};

/**
 * Route a natural-language prompt to the skill entries that cover it.
 *
 * @param {{ prompt?: string, limit?: number }} input
 * @returns {object} { prompt, concepts, first_move, results: {commands, references, mcp_tools}, instruction }
 */
export function routeTask({ prompt, limit } = {}) {
  if (!prompt || !String(prompt).trim()) {
    return {
      error: 'Input required: provide `prompt` — the task in natural language, e.g. "analytics panel with KPIs"',
      prompt: prompt ?? null,
      concepts: [],
      first_move: null,
      intent: 'build',
      results: { commands: [], references: [], mcp_tools: [] },
    };
  }

  const max = Math.min(Math.max(Number.isInteger(limit) ? limit : 5, 1), 12);
  const concepts = toConcepts(prompt);

  if (!concepts.length) {
    return {
      prompt,
      concepts: [],
      first_move: '/start',
      intent: isRepairIntent(prompt) ? 'repair' : 'build',
      results: { commands: [], references: [], mcp_tools: [] },
      instruction:
        'Nothing in that prompt survived stopword removal, so there is nothing to rank. Run /start — it reads the project and reports what is available before routing.',
    };
  }

  const scored = CORPUS.map((entry) => {
    const { score, matched } = scoreEntry(entry, concepts);
    return { entry, score, matched };
  })
    .filter((r) => r.score >= SCORE_FLOOR)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));

  const shape = (r) => ({
    name: r.entry.name,
    kind: KIND_LABEL[r.entry.kind] ?? r.entry.kind,
    path: r.entry.path,
    summary: r.entry.summary,
    score: r.score,
    matched: r.matched,
    ...(r.entry.tier ? { tier: r.entry.tier } : {}),
  });

  const commands = scored.filter((r) => r.entry.kind === 'command').slice(0, max).map(shape);
  const references = scored.filter((r) => r.entry.kind === 'reference').slice(0, max).map(shape);
  const mcpTools = scored.filter((r) => r.entry.kind === 'mcp_tool').slice(0, max).map(shape);

  if (!scored.length) {
    return {
      prompt,
      concepts: concepts.map((c) => c.token),
      first_move: '/start',
      intent: isRepairIntent(prompt) ? 'repair' : 'build',
      results: { commands: [], references: [], mcp_tools: [] },
      instruction:
        `Nothing in the corpus matched "${prompt}" above the noise floor. That is a real answer, not a fallback: ` +
        'this may be outside what the skill covers. Run /start to see what the project has, or state the surface ' +
        '(dashboard, landing, auth, form) directly.',
    };
  }

  // The first move is a command when one is in play, because a command is a thing the
  // agent can DO. A reference is only ever reading. When the top hit is a reference with
  // a command attached, name that command instead of handing back a file to read.
  //
  // A move still holding a placeholder ("/craft <surface>") loses to a concrete one
  // ("/craft landing") whenever a hit offers it: the recipe already knows the surface, so
  // handing back the placeholder would throw away the one thing the ranking just resolved.
  //
  // Candidates are ordered command → reference → mcp_tool, and only entries scoring within
  // RELEVANT_MOVE_RATIO of the winner may contribute. Both guards exist because a wrong
  // first move is worse than none: without the kind order a fold-inspection tool won the
  // move on a build prompt, and without the ratio a weakly-matched dashboard recipe
  // suggested "/craft dashboard" for a question about button sounds.
  const top = scored[0];
  const relevant = scored.filter((r) => r.score >= top.score * RELEVANT_MOVE_RATIO);
  // A repair prompt also reorders the candidates. A repair is answered by a PASS
  // (/audit, /critique, /animate), whereas a reference's attached move is its build-time
  // default — motion.md offering "/animate" outranked "/audit" on "this 3000-row table is
  // slow", which is a table problem, not a motion one.
  const repair = isRepairIntent(prompt);
  const bestCommand = relevant.find((r) => r.entry.kind === 'command');
  const commandFirst = bestCommand && (repair || bestCommand.score >= top.score * COMMAND_PREFERENCE_RATIO);
  const candidates = [
    ...(commandFirst ? [bestCommand] : []),
    ...relevant.filter((r) => r.entry.kind === 'reference'),
    ...(bestCommand ? [bestCommand] : []),
    ...relevant.filter((r) => r.entry.kind === 'mcp_tool'),
  ]
    .map((r) => r.entry.first_move)
    .filter(Boolean);

  // Repair also rules out the constructive moves: "the signup form validates wrong" is not
  // answered by building a new auth surface. When nothing but a build move is on offer,
  // the honest answer is no move at all plus the reference to read.
  const eligible = repair ? candidates.filter((move) => !BUILD_MOVE.test(move)) : candidates;
  const firstMove = eligible.find((move) => !move.includes('<')) ?? null;

  return {
    prompt,
    concepts: concepts.map((c) => c.token),
    first_move: firstMove,
    results: { commands, references, mcp_tools: mcpTools },
    intent: repair ? 'repair' : 'build',
    instruction:
      (firstMove
        ? `Start with ${firstMove}. `
        : `No command covers this — read ${(references[0] ?? shape(top)).path} first. ` +
          (repair
            ? 'This prompt describes something that already exists and is wrong, so a build command would be the wrong move. '
            : '')) +
      'Load the references listed above before writing code — Tier 1 entries are required reading, ' +
      'and Discovery (project analysis + the Quick Ask) still runs first. These are pointers only; ' +
      'every design rule lives in the files themselves.',
  };
}

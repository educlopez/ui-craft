# Animation Orchestration

A pattern for writing multi-stage animations as human-readable storyboards with named timing, config objects, and stage-driven sequencing.

---

## When to Use

- Writing or refactoring multi-stage animations
- User pastes animation code and wants it cleaned up
- User describes a desired animation in plain English
- Files with `motion.*` components that have inline timing/values

---

## The Pattern

Every animated component follows this structure:

### 1. ASCII Storyboard Comment

```
/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * Read top-to-bottom. Each `at` value is ms after trigger.
 *
 *    0ms   waiting for trigger (scroll into view / mount)
 *  300ms   card fades in, scale 0.85 → 1.0
 *  900ms   heading text highlights
 * 1500ms   detail rows slide up (staggered 200ms)
 * 2100ms   CTA button fades in
 * ───────────────────────────────────────────────────────── */
```

Rules: right-align ms, use `→` for transitions, note stagger intervals, one line per stage.

### 2. TIMING Object

```tsx
const TIMING = {
  cardAppear:  300,   // card fades in and scales up
  headingGlow: 900,   // heading text highlights
  detailRows:  1500,  // rows start staggering in
  ctaButton:   2100,  // button fades in
};
```

Rules: camelCase keys, values are ms after trigger (not deltas), inline comments, aligned values.

### 3. Element Config Objects

```tsx
const CARD = {
  initialScale: 0.85,
  finalScale:   1.0,
  spring: { type: "spring" as const, stiffness: 300, damping: 30 },
};

const ROWS = {
  stagger: 0.2,    // seconds between rows
  offsetY: 12,     // px each row slides from
  spring: { type: "spring" as const, stiffness: 300, damping: 30 },
  items: [
    { label: "Row 1", value: "A" },
    { label: "Row 2", value: "B" },
  ],
};
```

Rules: UPPERCASE names, group ALL values per element, arrays for repeated items, springs in config (never inline JSX), every value commented.

### 4. Component Body

```tsx
export function MyFigure({ replayTrigger = 0 }: { replayTrigger?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!isInView) { setStage(0); return; }
    setStage(0);
    const timers: NodeJS.Timeout[] = [];
    timers.push(setTimeout(() => setStage(1), TIMING.cardAppear));
    timers.push(setTimeout(() => setStage(2), TIMING.headingGlow));
    timers.push(setTimeout(() => setStage(3), TIMING.detailRows));
    timers.push(setTimeout(() => setStage(4), TIMING.ctaButton));
    return () => timers.forEach(clearTimeout);
  }, [isInView, replayTrigger]);

  return ( /* JSX using stage >= N and config values */ );
}
```

Rules: single `stage` integer (not booleans), one useEffect with all timers from TIMING, cleanup clears all, `replayTrigger` in deps for replay.

### 5. JSX Pattern

```tsx
<motion.div
  initial={{ opacity: 0, scale: CARD.initialScale }}
  animate={{
    opacity: stage >= 1 ? 1 : 0,
    scale:   stage >= 1 ? CARD.finalScale : CARD.initialScale,
  }}
  transition={CARD.spring}
>

{ROWS.items.map((item, i) => (
  <motion.div
    key={item.label}
    initial={{ opacity: 0, y: ROWS.offsetY }}
    animate={{
      opacity: stage >= 3 ? 1 : 0,
      y:       stage >= 3 ? 0 : ROWS.offsetY,
    }}
    transition={{ ...ROWS.spring, delay: i * ROWS.stagger }}
  >
    {item.label}
  </motion.div>
))}
```

Rules: JSX references config (`CARD.initialScale`, not `0.85`), stage checks use `>=`.

---

## Applying the Pattern

### Refactoring Existing Code
1. Read code, identify every animated element and timing
2. Extract magic numbers into config objects
3. Write storyboard comment
4. Create TIMING object
5. Create element configs
6. Rewrite with stage pattern
7. Replace repeated elements with `.map()` over data arrays

### Writing From Description
1. Parse into discrete stages with approximate timing
2. Write storyboard comment first — confirm with user if unclear
3. Define TIMING (300ms initial delay, 500-700ms between stages)
4. Define configs with springs:
   - Cards: `{ stiffness: 300, damping: 30 }`
   - Pop-ins: `{ stiffness: 500, damping: 25 }`
   - Slides: `{ stiffness: 350, damping: 28 }`
5. Build component

### Checklist
- [ ] Storyboard comment matches TIMING values
- [ ] Zero magic numbers in JSX or useEffect
- [ ] Springs in config objects, not inline
- [ ] Repeated elements use `.map()` over data array
- [ ] Stage values use `>=` checks
- [ ] `replayTrigger` in dependency array

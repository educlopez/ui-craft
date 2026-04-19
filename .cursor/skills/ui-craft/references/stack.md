# Stack: Motion / GSAP / Three.js

Load this reference **only when the user opts in during Discovery**. Every rule in `motion.md` still applies — this file covers the library-specific how.

## Decision tree — which library?

| Need | Pick |
|------|------|
| Single hover, fade, or enter | **CSS transition / `@keyframes`** (0KB, always wins) |
| Modern CSS scroll-linked reveal | **`animation-timeline: view()`** before any JS library |
| React layout/exit animations, gestures, scroll progress tied to state | **Motion** |
| Complex timelines with labels/overlaps, ScrollTrigger pin+scrub, SplitText, SVG paths, non-React | **GSAP** |
| 3D scenes, shaders, product viewers, particle fields | **Three.js + R3F** |

**Never install two animation libraries that animate the same property** — they will fight and one will silently lose. Pick one per surface.

---

## Motion (framer-motion)

Package renamed to `motion` on npm (legacy `framer-motion` still works).

### When to reach for it
- React component needs **exit** animation — `AnimatePresence` is the only clean way to animate unmounts.
- **Shared element transition** (tabs underline, modal-from-card) — `layoutId`.
- **Scroll-linked** progress bars, parallax tied to component state — `useScroll` + `useTransform`.
- **Gesture-driven** interactions (drag, pan).

### When NOT
- A single hover/fade/enter — CSS wins, no library needed.
- A one-off `@keyframes` spinner or loader.
- Non-React surfaces — use GSAP.

### Install
```bash
npm install motion
```
```tsx
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useReducedMotion,
  MotionConfig,
  LazyMotion,
  domAnimation,
} from "motion/react"
```

### Top patterns

**1. Exit animation with `AnimatePresence`**
```tsx
<AnimatePresence>
  {open && (
    <motion.div
      key="modal"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    />
  )}
</AnimatePresence>
```
Every child needs a unique `key`. Without `AnimatePresence`, `exit` is silently ignored.

**2. Shared element transition with `layoutId`**
```tsx
{tabs.map((tab) => (
  <button key={tab.id} onClick={() => setActive(tab.id)}>
    {tab.label}
    {active === tab.id && (
      <motion.div layoutId="tab-underline" className="underline" />
    )}
  </button>
))}
```
Animates position between elements sharing the same `layoutId`. FLIP-based, GPU-safe.

**3. Scroll progress (smoothed with `useSpring`)**
```tsx
const { scrollYProgress } = useScroll()
const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })
return (
  <motion.div
    style={{ scaleX: smooth, transformOrigin: "0%" }}
    className="fixed top-0 inset-x-0 h-[2px] bg-foreground"
  />
)
```
Always bind scroll-linked values via `style`, **never** via `animate` (would trigger React renders per frame). `useSpring` smooths without a RAF loop.

**3b. Viewport-triggered reveal**
```tsx
<motion.section
  initial={{ opacity: 0, y: 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-80px" }}
  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
/>
```
`once: true` prevents re-triggering on scroll back. Negative `margin` fires before the element is fully in view — feels natural, not delayed.

**4. Spring vs tween — pick ONE per project**
```tsx
// Spring (Motion default — physical, no fixed duration)
transition={{ type: "spring", bounce: 0.25, visualDuration: 0.3 }}

// Tween (deterministic, matches our 200–300ms rule)
transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
```
Mixing both within the same app reads as inconsistent. Document the choice.

**5. Reduced-motion, once for the whole app**
```tsx
<MotionConfig reducedMotion="user">
  <App />
</MotionConfig>
```
Or per-component with `useReducedMotion()` and branch the animation.

### Clashes with ui-craft rules

- Motion defaults to spring (good) but specs often call `{ duration, ease }`. **Pick lane per project**, don't mix.
- Springs have no fixed duration → our 200–300ms budget doesn't apply directly; constrain via `bounce ≤ 0.25` and `visualDuration`.
- `layout` animates via `transform` only → matches "GPU-accelerated transforms only".
- `whileHover={{ scale: 1.05 }}` on clickable cards feels toy-like — keep ≤ 1.02 for functional UI.

### Perf gotchas

- Full `motion` import ≈ 50KB gz. On marketing pages use **`LazyMotion` + `domAnimation`** for code-split:
  ```tsx
  <LazyMotion features={domAnimation}>
    <m.div animate={{ opacity: 1 }} />
  </LazyMotion>
  ```
- `layout` without stable `key`/`layoutId` on list items → every item reflows on any change. Use `layoutId` or `LayoutGroup`.
- Animating `width`/`height`/`top` triggers layout. Use `scale`, `x`, `y`.
- `useScroll({ container })` with `trackContentSize: true` has cost — only enable when content genuinely resizes.
- **Next.js App Router**: any file using `motion` hooks (`useScroll`, `useTransform`, `useSpring`, `useReducedMotion`) must be `'use client'`. Silent hydration mismatches otherwise.
- Inline `style={{ … }}` objects on `motion.div` create a new object every render → memoization busted. Hoist or `useMemo`.
- **Motion v12 animates `oklch()` / `oklab()` / `color-mix()` directly** — useful for dynamic theming. Example: `animate={{ backgroundColor: "oklch(70% 0.15 250)" }}`. Hardware-accelerated, no RGB interpolation artifacts.

### Anti-patterns (flag in review)

- `motion.div` wrapping every element "just in case" — each one adds an observer.
- `exit` prop without `AnimatePresence` — silently does nothing.
- `whileHover={{ scale: 1.08 }}` on buttons — fine for cards, too much for CTAs.
- `layout` on virtualized lists — kills FPS.
- `transition={{ duration: 2 }}` on functional UI — 300ms ceiling; longer only for decorative.
- Binding `scrollYProgress` to `animate={{ … }}` instead of `style={{ … }}` — one causes per-frame React renders, the other runs on the compositor.
- Permanent `style={{ willChange: "transform" }}` on motion elements — leaks compositor layers. Only just-in-time, via `whileHover` / `whileTap` or transient state.

---

## GSAP

All GSAP plugins (including ScrollTrigger, SplitText, MorphSVG) are MIT since late 2024.

### When to reach for it
- **Timelines with labels/overlaps** — sequence shots, re-use, rewind.
- **ScrollTrigger** — pin sections, scrub cinematic scenes, snap to waypoints.
- **SplitText** — per-line/word/char reveal on headlines.
- **SVG morphing/drawing** — `MorphSVG`, `DrawSVG`.
- **Non-React surfaces** — vanilla, canvas/WebGL tweening.

### When NOT
- A hover state or enter animation in React — Motion is more ergonomic.
- Anything CSS `animation-timeline: view()` can do natively in evergreens.
- Text splitting on body copy — huge DOM cost + a11y risk. Headlines only.

### Install
```bash
npm install gsap @gsap/react
```
```ts
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { SplitText } from "gsap/SplitText"
import { useGSAP } from "@gsap/react"

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP)
```
Always `registerPlugin()` — in production bundlers will otherwise tree-shake plugins to nothing (silent failure).

### Top patterns

**1. `useGSAP` hook (React) — auto-cleanup, StrictMode safe**
```tsx
const ref = useRef<HTMLDivElement>(null)
useGSAP(
  () => {
    gsap.from(".card", { y: 40, opacity: 0, stagger: 0.08, duration: 0.3 })
  },
  { scope: ref }
)
return <div ref={ref}>…</div>
```
Wraps `gsap.context()` so everything reverts on unmount. Never use raw `useEffect` for GSAP in React.

**2. Timeline with labels**
```ts
const tl = gsap.timeline({
  defaults: { ease: "power2.out", duration: 0.3 },
})
tl.from(".title", { y: 40, opacity: 0 })
  .from(".sub",   { opacity: 0 }, "-=0.2") // overlap 200ms
  .addLabel("hero-done")
```
Overlap with relative offsets keeps sequences tight.

**3. ScrollTrigger pin + scrub**
```ts
gsap.to(".panel", {
  xPercent: -300,
  scrollTrigger: {
    trigger: ".panels",
    pin: true,
    scrub: 1,               // smooth with 1s catch-up, never `true`
    end: "+=2000",
    invalidateOnRefresh: true,
  },
})
```
Use `scrub: 1` (or higher), not `true` — `true` welds the animation to the wheel and jitters.

**4. SplitText (headlines only)**
```ts
const split = SplitText.create(".headline", { type: "lines,words" })
gsap.from(split.words, {
  y: 24,
  opacity: 0,
  stagger: 0.02,
  duration: 0.4,
  ease: "power3.out",
})
```
Revert with `split.revert()` in cleanup. `@gsap/react` handles it if scoped.

**5. `matchMedia` for responsive + reduced-motion**
```ts
const mm = gsap.matchMedia()
mm.add("(prefers-reduced-motion: no-preference)", () => {
  // animations here
})
mm.add("(min-width: 768px)", () => {
  // desktop-only pins
})
```
This is the only sane way to handle reduced-motion and breakpoints together in GSAP.

**6. `quickTo` for high-frequency updates (mouse follower, pointer-linked)**
```ts
const xTo = gsap.quickTo("#dot", "x", { duration: 0.4, ease: "power3" })
const yTo = gsap.quickTo("#dot", "y", { duration: 0.4, ease: "power3" })
window.addEventListener("pointermove", (e) => { xTo(e.clientX); yTo(e.clientY) })
```
Reuses one tween instead of creating a new tween per event — crucial for pointer/scroll handlers that fire 60+ times/sec. Never `gsap.to()` inside a frequent event handler.

**7. `autoAlpha` over `opacity`**
```ts
gsap.to(".menu", { autoAlpha: 0, duration: 0.2 })
```
`autoAlpha` animates opacity **and** toggles `visibility: hidden` at 0 — hidden elements stop catching pointer events and get skipped by screen readers. `opacity: 0` alone does neither.

### Clashes with ui-craft rules

- Default ease is `power1.out` — flat. For UI use `power2.out` or `power3.out`; for springiness `back.out(1.4)` sparingly. **Avoid `elastic` / `bounce` on functional UI** — reads as demo.
- Default `duration: 0.5` — trim to **0.2–0.3 for UI**; keep 0.5–1.2 for hero scroll scenes only.
- GSAP animates any property — easy to accidentally animate `left` / `top` / `width` (layout thrash). Stick to `x`, `y`, `scale`, `rotation`, `opacity`, `autoAlpha`.
- No default reduced-motion — wrap in `gsap.matchMedia` or early-return on `matchMedia("(prefers-reduced-motion: reduce)").matches`.

### Perf gotchas

- Core ≈ 25KB gz, +7KB ScrollTrigger, +11KB SplitText. Import named plugins only.
- Forgetting `registerPlugin()` → tree-shaken in production → silent failure.
- Timelines not killed on unmount (outside `useGSAP`) → orphan RAF ticks. Always `ctx.revert()` in cleanup.
- More than ~50 independent `ScrollTrigger`s with `scrub` → RAF stalls. Batch into one timeline.
- **`immediateRender` trap**: a second `from()` / `fromTo()` targeting the same property on the same element will snap to its start value immediately, overwriting earlier tweens. Pass `immediateRender: false` on all but the first.
- `ScrollTrigger.refresh()` is expensive — don't call it on every `resize`. Debounce, or only on orientation change / content load. `invalidateOnRefresh: true` on the trigger handles most recalcs automatically.
- Use `clearProps: "all"` at the end of a tween to remove the inline styles GSAP wrote, preventing conflicts with CSS states (hover, `:active`) afterwards.
- **Pause animations off-screen with `IntersectionObserver`**. On long pages with multiple timelines, idle sections still burn RAF cycles. Pause them:
  ```ts
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) tl.play()
    else tl.pause()
  })
  io.observe(container)
  ```
  Or use ScrollTrigger's `toggleActions: "play pause resume pause"` which handles this natively.

### Anti-patterns

- Reaching for GSAP for what one `transition: transform 200ms ease-out` would do.
- Pinning every section — "scroll jacking". Pin 1-2 hero sections, max.
- `scrub: true` — jittery. Use `scrub: 1`.
- SplitText on body copy — huge DOM cost, a11y nightmare. Headlines only.
- Mixing `gsap.to` with Motion or CSS transitions on the same property — they fight.

---

## Three.js + React Three Fiber

R3F v9 pairs with React 19; v8 with React 18. `drei` is the swiss-army helper set — always install alongside.

### When to reach for it
- **3D product viewers** the user rotates.
- **Interactive hero scenes** where the scene reacts to scroll or cursor.
- **Data viz in 3D** (rare — prefer 2D unless the extra dimension is load-bearing).
- **Shaders** tied to React state.

### When NOT
- A marketing page that could be a **WebP/MP4** — users on phones pay 400KB + GPU for nothing.
- Static logo rotation — CSS 3D transforms.
- Decorative 2D canvas — `<canvas>` + Motion.

### Install
```bash
npm install three @react-three/fiber @react-three/drei
```
```tsx
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import {
  Environment,
  OrbitControls,
  useGLTF,
  PerformanceMonitor,
} from "@react-three/drei"
```

### Top patterns

**1. Canvas with perf caps (always)**
```tsx
<Canvas
  dpr={[1, 2]}             // cap retina cost
  frameloop="demand"       // render only when props change
  camera={{ position: [0, 0, 5], fov: 45 }}
  gl={{ antialias: true, powerPreference: "high-performance" }}
>
  <ambientLight intensity={0.5} />
  <Environment preset="city" />
  <Model />
</Canvas>
```
`dpr={[1, 2]}` + `frameloop="demand"` is the responsible default. Most "heavy" R3F demos are heavy because they omit these.

**2. `useFrame` with delta, never fixed increments**
```tsx
useFrame((_, dt) => {
  ref.current.rotation.y += dt * 0.5 // speed in rad/sec, framerate-independent
})
```
Never `+= 0.01` — ties speed to framerate (feels fast on 120Hz, slow on 60Hz).

**3. `<Environment />` + `<Lightformer />` for lighting**
```tsx
<Environment preset="studio" />
```
Presets (`studio`, `city`, `sunset`, `warehouse`, `apartment`) cover 90% of cases. Beats five hand-placed lights.

**4. Instancing for repeats**
```tsx
<instancedMesh args={[null, null, 10000]}>
  <boxGeometry args={[0.1, 0.1, 0.1]} />
  <meshStandardMaterial />
</instancedMesh>
```
One draw call for 10k objects. Use when the same mesh repeats more than ~50 times.

**5. Auto-degrade with `PerformanceMonitor` (drei)**
```tsx
const [dpr, setDpr] = useState(1.5)
return (
  <Canvas dpr={dpr}>
    <PerformanceMonitor
      onDecline={() => setDpr(1)}
      onIncline={() => setDpr(2)}
    />
    …
  </Canvas>
)
```
Drops `dpr` automatically on low FPS. Ship this on any production scene.

**6. `<Suspense>` with nested progressive loading**
```tsx
<Canvas>
  <Suspense fallback={<Model url="/model-low.glb" />}>
    <Model url="/model-high.glb" />
  </Suspense>
</Canvas>
```
Every `useLoader` / `useGLTF` / `useTexture` **must** live under a Suspense boundary. Nesting lets you show a low-res placeholder while the high-res loads, then swap — zero blank frames.

**6b. DOM overlays inside the scene with `<Html>` (drei)**
```tsx
import { Html } from "@react-three/drei"

<mesh position={[0, 1, 0]}>
  <Html distanceFactor={8} occlude="blending">
    <div className="rounded-md bg-background/90 px-2 py-1 text-xs">Label</div>
  </Html>
</mesh>
```
`distanceFactor` scales with camera distance (so labels don't balloon on zoom). `occlude` hides the overlay when geometry blocks it — respects depth without feeling cheap.

**6c. Axis-specific prop notation**
```tsx
// Instead of <mesh position={[x, 0, 0]}> on every render:
<mesh position-x={x} />
```
Avoids recreating the `[x, y, z]` tuple each frame and reads cleaner when animating a single axis via state/ref.

**7. Auto-fit camera with `<Bounds>` + `<Center>`**
```tsx
import { Bounds, Center } from "@react-three/drei"

<Canvas>
  <Bounds fit clip observe margin={1.2}>
    <Center><Model /></Center>
  </Bounds>
</Canvas>
```
Stops the "model invisible because the camera is inside it" footgun. `observe` re-fits on model change.

### Clashes with ui-craft rules

- Three.js runs **its own RAF** — independent of CSS `prefers-reduced-motion`. Read it in React and cut autorotate / camera drift:
  ```tsx
  const reduced = useReducedMotion()
  useFrame((_, dt) => {
    if (!reduced) ref.current.rotation.y += dt * 0.2
  })
  ```
- Heavy lighting/shadows violate the spirit of "GPU-accelerated transforms only" by burning GPU on everything. Budget draw calls and shadow resolution.
- Default `Canvas` runs 60fps forever — battery killer. **`frameloop="demand"` is the default**, not the optimization.

### Perf gotchas

- **No `dpr` cap** → 3× pixel cost on retina. Always `dpr={[1, 2]}`.
- Mutating position/rotation via React state → re-render per frame. Mutate via `ref` inside `useFrame`.
- Loading `.glb` in component body → re-fetches on remount. Use `useGLTF("/model.glb")` (cached) + `useGLTF.preload("/model.glb")` at module scope.
- **Compress assets**: GLB via DRACO (`useGLTF("/model.glb", "/draco/")`) + textures via KTX2 (`useKTX2Loader`). Routine 60-80% size reduction. Uncompressed GLBs are the #1 cause of "my 3D page is 8MB".
- `frameloop="demand"` + external state change (window resize, parent re-render) → scene goes stale. Call `invalidate()` from `useThree()` to trigger one render frame manually.
- Draw-call budget: **~200 meshes mobile, ~1000 desktop**. Beyond → instance, merge, or LOD (`<Detailed />` from drei).
- Custom shaders / textures need explicit `.dispose()` on unmount — R3F handles standard cases but external refs leak.

### Anti-patterns

- `<Canvas>` with no `dpr` cap and `frameloop="always"` on a mostly-static hero.
- `new THREE.Vector3()` / `new THREE.Color()` inside `useFrame` — GC pressure every frame. Hoist to `useMemo` or module scope.
- `OrbitControls` on a marketing page — confuses users. `autoRotate` only, or omit.
- 10k individual `<mesh>` instead of `<instancedMesh>`.
- Post-processing stack (bloom + DoF + SSAO) shipped to phones — feature-flag by device or user preference.
- A scene that would be a 60KB WebP rendered server-side.

---

## Cross-stack rules

1. **One library per property.** Never let Motion and GSAP animate the same `transform`. Never let Three.js drive DOM transforms that CSS is also animating.
2. **Reduced-motion is non-negotiable across all three.** Motion: `MotionConfig reducedMotion="user"`. GSAP: `matchMedia("(prefers-reduced-motion: no-preference)")`. Three.js: read `useReducedMotion()` and cut autorotate / idle drift.
3. **Spring vs tween is a project-level choice**, not a per-component one. Document it.
4. **GPU-accelerated transforms only.** Motion's `layout` and GSAP's `x`/`y`/`scale` honor this; animating `width`/`top` does not. Three.js runs on the GPU, but lighting/shadows/post-processing are their own budget.
5. **Budget, then build.** Bundle: Motion ≈ 50KB, GSAP core ≈ 25KB, Three.js ≈ 150KB, R3F + drei another 30-80KB. If you're shipping all three to one page, stop — one of them is wrong.
6. **`will-change` discipline.** Set `will-change: transform` only **just before** the animation fires (e.g. on `:hover`, in a `whileHover`, before a `gsap.to` call) and remove it after. Persistent `will-change` leaks compositor layers and eats GPU memory. Never set it globally on `*`.
7. **No smooth-scroll libraries (Lenis, Locomotive, ScrollSmoother) unless the design absolutely demands it.** They hijack native scroll, break touch momentum on iOS, fight `prefers-reduced-motion`, and make Cmd-F scroll-to-match janky. Prefer native scroll + `scroll-behavior: smooth` on specific anchors + `animation-timeline: scroll()` for reveal effects.
8. **Strip debug artifacts before ship.** GSAP `ScrollTrigger` `markers: true`, R3F `<Stats />`, drei `<Perf />`, `<OrbitControls />` on marketing pages, Leva panels, `console.log` in `useFrame`. Grep the diff before merging.

# Sound Design for UI

Web Audio API best practices, UI sound appropriateness, and implementation.

---

## When Sound is Appropriate

| Interaction | Sound? | Reason |
|-------------|--------|--------|
| Payment success | Yes | Significant confirmation |
| Form submission | Yes | User needs assurance |
| Error state | Yes | Can't be overlooked |
| Notification | Yes | User may not be looking |
| Significant button | Maybe | Only for important actions |
| Typing | **No** | Too frequent |
| Hover | **No** | Decorative only |
| Scroll | **No** | Too frequent |
| Navigation | **No** | Keyboard nav would be noisy |

---

## Accessibility Rules

- Every audio cue MUST have a visual equivalent — sound never replaces visual feedback
- Provide explicit toggle to disable sounds in settings
- Respect `prefers-reduced-motion` as proxy for sound sensitivity
- Allow volume adjustment independent of system volume
- Never add sound to high-frequency interactions
- Sound should inform, not punish — avoid harsh sounds for mistakes

---

## Web Audio API Implementation

### Single AudioContext (Critical)
```ts
let audioContext: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}
```

Never create new AudioContext per sound.

### Resume Suspended Context
```ts
if (ctx.state === "suspended") ctx.resume();
```

### Clean Up Nodes
```ts
source.onended = () => { source.disconnect(); gain.disconnect(); };
```

---

## Sound Design Patterns

### Clicks/Taps (Percussion) — Use Filtered Noise
```ts
const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.008, ctx.sampleRate);
const data = buffer.getChannelData(0);
for (let i = 0; i < data.length; i++) {
  data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 50);
}

const filter = ctx.createBiquadFilter();
filter.type = "bandpass";
filter.frequency.value = 4000;  // 3000-6000Hz range
filter.Q.value = 3;             // 2-5 for focused but not harsh
source.connect(filter).connect(gain).connect(ctx.destination);
```

### Confirmations/Pops (Tonal) — Use Oscillators
```ts
const osc = ctx.createOscillator();
osc.frequency.setValueAtTime(400, t);
osc.frequency.exponentialRampToValueAtTime(600, t + 0.04);
```

### Envelope (Always Exponential Decay)
```ts
gain.gain.setValueAtTime(0.3, t);  // set initial value first
gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);  // never target 0
```

---

## Parameters

| Parameter | Range | Notes |
|-----------|-------|-------|
| Click duration | 5-15ms | Quick and percussive |
| Filter frequency | 3000-6000Hz | For click sounds |
| Filter Q | 2-5 | Focused but not harsh |
| Gain | ≤ 1.0 | Prevent clipping |
| Default volume | 0.3 | Subtle, not loud |

### Tuning from Feedback

| User Says | Adjustment |
|-----------|------------|
| "too harsh" | Lower filter frequency, reduce Q |
| "too muffled" | Higher filter frequency |
| "too long" | Shorter duration, faster decay |
| "cuts off" | Use exponential decay |
| "more mechanical" | Higher Q, faster decay |
| "softer" | Lower gain, triangle wave |

---

## Weight Matching

Sound weight should match action importance:
- **Subtle click** for toggle switches
- **Soft pop** for adding items
- **Rich confirmation** for purchases/payments
- **Brief alert** for errors

Sound duration should match action duration:
- **50ms** for clicks/taps
- **100-200ms** for confirmations
- **Longer** for uploads/completions

---

## Preloading

```ts
const sounds = {
  success: new Audio("/sounds/success.mp3"),
  error: new Audio("/sounds/error.mp3"),
};
Object.values(sounds).forEach(audio => audio.load());

// Reset before replay for rapid triggering
function play(sound: HTMLAudioElement) {
  sound.currentTime = 0;
  sound.play();
}
```

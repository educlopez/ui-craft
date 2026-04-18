# Real-World SaaS Landing Page Patterns

Reference analysis of 5 best-in-class SaaS sites: dub.co, cursor.com, linear.app, vercel.com, stripe.com. Updated March 2025.

---

## 1. Cross-Site Patterns (Universal Rules)

These patterns appear across all 5 sites. Treat them as proven conventions.

| Pattern | Detail |
|---------|--------|
| **Product screenshots with real data** | Never mockups, illustrations, or abstract graphics. Show the actual product with realistic numbers and content. |
| **Specific metrics in social proof** | "Build times went from 7m to 40s" beats "Trusted by thousands." Quantify the transformation. |
| **Tabs or interactive sections for features** | Feature areas use tabs, toggles, or interactive demos — never identical 3-column card grids. |
| **Dual CTAs in the hero** | Primary action (solid) + secondary action (outline/ghost). "Start for free" + "Get a demo" pattern. |
| **One positioning statement** | Hero headline is a single sentence that defines what the product is. No paragraphs. |
| **Logo strips of real companies** | "Trusted by" followed by 5-8 recognizable, specific company logos. |
| **Minimal decoration** | Content IS the design. No ornamental gradients, blobs, or abstract shapes competing with the product. |
| **Changelog/velocity proof** | At least one section proves the product ships fast — changelogs, release notes, version timelines. |
| **Every section has a distinct layout** | No two adjacent sections share the same visual structure. Variety signals intentional design. |
| **Centered hero alignment** | All 5 sites center their hero text. Left-aligned heroes are less common in modern SaaS. |

---

## 2. Per-Site Signature Details

What makes each site distinctive. Use for inspiration, not direct copying.

### Dub.co
- **Scrolling logo strip** — logos scroll horizontally in a continuous loop, not static
- **Tab-based feature nav** — "Short Links / Conversion Analytics / Affiliate Programs" as interactive tabs, each revealing different content
- **QR code interactive preview** — unique product-specific detail that doubles as a demo
- **"We ship fast" section** — changelog entries with dates proving velocity
- **Blue accent used sparingly** — `#2563eb` appears only in CTAs and key interactive elements

### Cursor.com
- **Product-first hero** — massive IDE screenshot below a minimal headline, product speaks for itself
- **Photography as texture** — landscape wallpaper images behind IDE demos, not abstract gradients
- **Research table** — year/project/status in a simple HTML table, elegant and informational
- **Interactive embedded demos** — not static screenshots but actual code diffs running on the page
- **Mission statement section** — "Software creation is changing" — a philosophical anchor mid-page

### Linear.app
- **Figure numbering** — "FIG 0.2", "FIG 0.3" as editorial labels on sections, gives a technical publication feel
- **Provocative CTA** — "Issue tracking is dead" — strong opinion, not generic "Sign up free"
- **Live product UI embedded** — actual product interface rendered on the page, not a screenshot
- **Value props as labeled figures** — 3 concepts presented as numbered editorial figures, not cards
- **Dark premium with subtle gradients** — darkness serves the product (dark UI = dark marketing)

### Vercel.com
- **Light/dark adaptive** — both theme versions available, not committed to one
- **Specific customer metrics** — "build times went from 7m to 40s" next to the customer logo
- **Framework logos** — tech stack displayed as recognizable framework icons
- **Tab sections by use case** — "AI Apps / Web Apps / Ecommerce / Marketing / Platforms"
- **Terminal output as social proof** — showing real deployment logs and build output

### Stripe.com
- **Animated wave/gradient backgrounds** — signature branded element, NOT generic blobs. Intentional, recognizable, ownable
- **Bento grid layout** — varied card sizes for product features, breaking the uniform grid
- **Real payment UIs** — billing plans, card issuing, crypto interfaces as screenshots
- **Financial data with real-looking numbers** — specific dollar amounts, growth percentages
- **Premium typography with italics** — italicized hero headlines as a distinctive typographic choice

---

## 3. Hero Section Patterns by Site

| Site | Alignment | Headline Style | CTAs | Below Hero |
|------|-----------|---------------|------|------------|
| **Dub.co** | Center | Short declarative statement | Dual: solid "Start for free" + outline "Get a demo" | Scrolling logo strip |
| **Cursor.com** | Center | Single word/phrase | Single: "Download" | Massive product screenshot |
| **Linear.app** | Center | Category-defining statement ("The product development system") | Single: provocative link ("Issue tracking is dead") | Live product UI |
| **Vercel.com** | Center | Action-oriented ("Build and deploy on the AI Cloud") | Dual: "Start Deploying" + "Get a Demo" | Customer logos with metrics |
| **Stripe.com** | Center | Italicized positioning statement | Dual: primary CTA + Google auth | Bento grid of product features |

### Synthesis
- All use centered alignment
- Headlines are 5-10 words maximum
- 3 of 5 use dual CTAs, 2 use single
- Product proof appears immediately after the hero (no filler sections)

---

## 4. Social Proof Patterns

| Pattern | Sites Using It | Implementation |
|---------|---------------|----------------|
| **Logo strip** | All 5 | Horizontal row of 5-8 company logos, monochrome or muted. "Trusted by" or "Used by teams at" |
| **Specific metrics** | Vercel, Dub | Metric + customer name: "7m to 40s build times" next to company logo |
| **Testimonial with identity** | Dub, Linear | Photo + name + title + company logo. Quote is specific, references the product feature |
| **Customer count** | Dub, Vercel | "Join 50,000+ teams" or similar, placed near CTA |
| **Changelog as proof** | Dub, Cursor | Release dates and features listed to show shipping velocity |

### What makes social proof work
- **Specificity over volume** — one concrete metric beats "trusted by thousands"
- **Recognizable logos** — users infer quality from the companies they recognize
- **Real quotes with attribution** — name, role, company, photo. Generic praise without identity is worthless
- **Proximity to CTAs** — social proof placed directly before or after the call to action

---

## 5. Feature Presentation Patterns

None of these sites use identical card grids for features. Here is what they use instead:

### Tab-based feature sections
**Used by:** Dub.co, Vercel.com
- Horizontal tabs or pills at the top of a section
- Each tab reveals completely different content (screenshot, demo, description)
- Prevents the monotonous 3-column icon+heading+text grid

### Bento grid (varied card sizes)
**Used by:** Stripe.com
- Mixed card dimensions: one large card + 2-3 smaller cards
- Each card shows a different product surface (billing, payments, issuing)
- Unequal sizing creates visual hierarchy within the grid

### Editorial figures
**Used by:** Linear.app
- Value propositions presented as numbered figures ("FIG 0.2")
- Each figure gets a distinct layout treatment
- Feels like a technical publication, not a marketing template

### Product-first (screenshots as features)
**Used by:** Cursor.com, Linear.app
- Instead of describing features, they embed the actual product
- Interactive demos, live UI, or high-fidelity screenshots
- The product IS the feature presentation

### Alternating text + visual rows
**Used by:** Dub.co, Vercel.com
- Text on one side, visual (screenshot/demo) on the other
- Sides alternate per row to create rhythm
- Each visual is unique — chart, screenshot, code block

### Key principle
Every feature section should feel like it was designed individually for that feature. If you can swap two feature blocks and nobody notices, the design is too uniform.

---

## 6. What Best-in-Class Sites Never Do

Confirmed absent across all 5 sites:

| Anti-Pattern | Why It Fails |
|-------------|-------------|
| **Emoji icons in feature lists** | Looks unfinished. Every site uses custom SVG icons or product screenshots. |
| **Colored gradient text** | None use rainbow or multi-color gradient text. Even dark-themed Cursor avoids it. |
| **Star ratings in testimonials** | Zero instances. All use quote + name + role + company. |
| **Identical 3-column feature cards** | No site repeats the same card layout for features. Each section is bespoke. |
| **Placeholder or generic text** | Every piece of text is specific to the product. No "lorem ipsum" energy. |
| **Bouncy/elastic animations** | Motion is subtle and functional. No bounce, no wiggle, no playful easing. |
| **Colored pill badges for metrics** | Metrics are displayed as plain text with clear hierarchy, not decorated badges. |
| **ALL CAPS headings** | All 5 use sentence case or title case. No uppercase headings. |
| **Glassmorphism** | Not a single frosted-glass panel. Even the dark-themed sites avoid it. |
| **Abstract blob/orb decorations** | Stripe uses intentional branded gradients. Nobody uses generic decorative blobs. |
| **Multiple competing accent colors** | Each site has one accent color used consistently and sparingly. |
| **"Powered by" or tool attribution** | No marketing page advertises what it was built with in the footer. |
| **Generic CTAs** | No "Learn more" or "Click here." Every CTA is specific: "Start for free", "Download", "Start Deploying". |
| **Walls of text** | No section has more than 2-3 sentences. Copy is ruthlessly concise. |
| **Pure black text** | None use `#000000`. Darkest text is cool gray like `#414552` (Stripe) or `#18181b` (Tailwind zinc-900). |

---

## 7. Reference Values from Stripe's Design System

Extracted from Stripe's actual CSS tokens. Use as calibration for "what premium feels like in code."

**Shadows** (blue-gray tinted, never pure black):
```css
/* Resting */ box-shadow: rgb(64 68 82 / 8%) 0px 2px 5px 0px;
/* Hover */  box-shadow: rgb(64 68 82 / 8%) 0px 2px 5px 0px, rgb(64 68 82 / 8%) 0px 3px 9px 0px;
/* Focus */  box-shadow: 0 0 0 4px rgb(1 150 237 / 36%);
```

**Border-radius** (restrained — max 10px for standard elements):
```
Inputs: 4px | Buttons: 8px | Cards: 8-10px | Pills/badges: 999em
```

**Typography** (negative letter-spacing on headings):
```
Hero (76-94px):     weight 700, line-height 1.05, letter-spacing -0.04em
Section (48-56px):  weight 700, line-height 1.1,  letter-spacing -0.03em
Card (24-32px):     weight 600, line-height 1.2,  letter-spacing -0.02em
Body (16-17px):     weight 400, line-height 1.5,  letter-spacing normal
```

**Spacing** (4px base unit):
```
Section gaps: 80-120px | Card gaps: 24-32px | Card padding: 24-40px
Nav height: 64px | Max content width: 1080-1200px
```

**Color** (never pure black, cool-toned grays):
```
Text primary:   #414552 (gray-700, NOT #000)
Text secondary: #687385 (gray-500)
Borders:        #d5dbe1 (gray-150)
Surface:        #f6f8fa (gray-50)
Brand accent:   #625afa (purple-500)
```

**Hover transitions**: `150-200ms ease-out`, `translateY(-2px)` + shadow growth

---

## 8. Reference Values from Dub.co's Design System

Extracted from Dub.co's actual CSS/Tailwind. Next.js + Tailwind v3.4.4 + Radix UI.

**Fonts**: Inter (body), Satoshi (display headings), Geist Mono (code)

**Font weight distribution** (from class frequency):
```
font-weight: 500 (Tailwind: font-medium): 120 uses — the dominant weight
font-weight: 600 (Tailwind: font-semibold): 34 uses — emphasis only
font-weight: 700: NEVER used — Dub avoids bold entirely
```

**Signature hover**: Ring-halo effect instead of shadow/color change:
```css
/* CSS: */ box-shadow: 0 0 0 4px var(--neutral-200, #e5e5e5);
/* Tailwind: hover:ring-4 hover:ring-neutral-200 — 13 elements use this pattern */
```

**Signature visual**: Inset shadows for sunken/embedded surfaces:
```css
box-shadow: 0 2px 6px 0 rgba(0,0,0,0.2) inset;
```

**Grid-line border aesthetic**: Uses horizontal and vertical borders (`border-left` + `border-right`, `border-top` + `border-bottom` / Tailwind: `border-x`, `border-y`) with a custom grid-border color for a technical grid feel.

**Motion**: slide-up-fade entrance with 50ms staggered delays, `transition-duration: 500ms` (Tailwind: `duration-500`) as primary timing. Targeted transition properties, never `transition: all`.

**Radius hierarchy**:
```
Buttons: border-radius: 8px (Tailwind: rounded-lg)
Cards: border-radius: 12-16px (Tailwind: rounded-xl / rounded-2xl)
Badges: border-radius: 9999px (Tailwind: rounded-full)
```

**Color approach**: Nearly colorless UI — neutral-first palette using RGB custom properties for alpha compositing. Color is reserved for status and brand accent only. Dark mode uses alpha-based white overlays (`color: rgba(255,255,255,0.9)`, `background: rgba(255,255,255,0.1)` on hover / Tailwind: `text-white/90`, `hover:bg-white/10`).

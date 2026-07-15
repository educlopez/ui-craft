# Metadata

Page metadata quality — correctness of what's already being emitted, not SEO strategy. For keyword strategy, content structure, or ranking tactics, defer to an SEO skill; this file is about the mechanical contract between what a page claims about itself and what actually ships.

---

## When to Read This

Read when a task touches `<title>`, `<meta>` tags, canonical URLs, Open Graph / Twitter Card tags, structured data (JSON-LD), or favicons — building a new page template, auditing an existing site, or wiring up a metadata API in a framework (Next.js `generateMetadata`, Remix `meta`, etc.).

---

## Social Sharing Tags

Any page that could get pasted into Slack, X, LinkedIn, or iMessage needs `og:title`, `og:image`, and `twitter:card` present at minimum. Drop one and the platform improvises — usually a generic card, sometimes a broken one.

```html
<meta property="og:title" content="Page title" />
<meta property="og:description" content="One or two sentences." />
<meta property="og:image" content="https://example.com/og/page-slug.png" />
<meta property="og:url" content="https://example.com/page-slug" />
<meta name="twitter:card" content="summary_large_image" />
```

Tags existing in the page source proves nothing about how a card actually renders. Crawlers for these platforms can't resolve `localhost`, so the only real test is pasting a live deployed link into the destination (or its dedicated preview debugger) and reading what comes back.

---

## Deterministic Metadata

Nothing feeding a title, description, or JSON-LD block should trace back to an unstable input — no `Math.random()`, no `Date.now()`, no client-only state read before first paint.

Two distinct failures follow from ignoring this:
- **Hydration mismatch** — the server-rendered value and the client's first pass disagree, and the framework flags it.
- **A stuck preview cache** — social platforms fetch a URL's metadata once and cache the result. If that single fetch happened to capture a randomized or time-sensitive value, every future share of that link shows the same wrong preview, with no external way to force a refresh.

Pull metadata only from route params, fetched content, or build-time constants.

---

## Identity Consistency

Title, description, canonical URL, and `og:url` all describe one page — a contradiction between any two of them (a title selling one thing, a description written for another) is a bug, not a stylistic quirk.

Settle on the page's single canonical form up front — trailing slash or not, `www` or not, query params stripped or kept — and reuse that exact string in the canonical tag, the sitemap, internal links, and the Open Graph URL. Letting any of these drift from the others leaves crawlers guessing which version is authoritative, which can split ranking signal across what should be one page.

---

## Non-Production Indexing

Preview deployments, staging environments, and branch builds ship with search indexing turned off:

```html
<meta name="robots" content="noindex, nofollow" />
```

Wire this to the environment itself — a build-time flag, not a checkbox a person remembers to tick — because the one deploy someone forgets is exactly the one that matters. An indexed staging URL then competes with the real page in search results and can surface content before it's meant to be public.

---

## Structured Data (JSON-LD)

Structured data should restate facts that already exist elsewhere on the page, not add new ones for the crawler's benefit.

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Actual product name",
  "offers": {
    "@type": "Offer",
    "price": "49.00",
    "priceCurrency": "USD"
  }
}
```

Don't fabricate organization details that aren't published anywhere, a price the product doesn't actually charge, a review count nobody left, or a `ratingValue` backed by zero reviews. Search engines diff structured data against the visible page and penalize the mismatch — and beyond the penalty, a made-up rating is a false claim presented to users as fact. No reviews yet means the `AggregateRating` block gets omitted, not filled with placeholder numbers.

---

## Favicons & Touch Icons

A single `favicon.ico` doesn't cover the surfaces that request icons — browsers, home-screen bookmarks, and OS task switchers each ask for a different size, and any size that isn't supplied falls back to an unstyled default glyph.

```html
<link rel="icon" href="/favicon.ico" sizes="32x32" />
<link rel="icon" href="/icon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
<link rel="manifest" href="/site.webmanifest" />
```

---

## Cross-References

- `accessibility.md` — semantic structure that structured data and screen readers both depend on.
- `responsive.md` — `og:image` dimensions and safe-area concerns for share-preview screenshots.

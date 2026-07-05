// Slop fixture: the templated AI landing page — eyebrow above every section,
// numbered section counters, a scroll cue in the hero, and two CTA labels
// wearing the same intent.
// Expected: low score (eyebrow-flood + section-number-eyebrow x2 + scroll-cue
// + duplicate-cta-intent + generic-cta)

export default function Landing() {
  return (
    <main>
      <section className="px-8 py-24">
        <p className="text-xs uppercase tracking-widest text-neutral-500">Introducing</p>
        <h1 className="mt-4 text-6xl font-semibold tracking-tight">Ship reports faster</h1>
        <p className="mt-4 max-w-xl text-neutral-600">
          The reporting workspace for finance teams that close in days, not weeks.
        </p>
        <a
          href="/signup"
          className="mt-8 inline-block rounded-md bg-neutral-900 px-5 py-2.5 text-white"
        >
          Get in touch
        </a>
        <span className="mt-16 block text-center text-xs text-neutral-400">Scroll to explore</span>
      </section>

      <section className="px-8 py-24">
        <p className="text-xs uppercase tracking-widest text-neutral-500">01 · Features</p>
        <h2 className="mt-4 text-3xl font-semibold uppercase tracking-wide">Everything in one place</h2>
        <p className="mt-3 max-w-lg text-neutral-600">
          Dashboards, exports, and alerts without leaving the workspace.
        </p>
      </section>

      <section className="px-8 py-24">
        <p className="text-xs uppercase tracking-widest text-neutral-500">02 · Process</p>
        <h2 className="mt-4 text-3xl font-semibold">Close the books in three steps</h2>
        <a href="/docs" className="mt-6 inline-block text-neutral-700 underline">Learn more</a>
      </section>

      <section className="px-8 py-24">
        <p className="text-xs uppercase tracking-widest text-neutral-500">Pricing</p>
        <h2 className="mt-4 text-3xl font-semibold">Plans that scale with you</h2>
        <button
          type="button"
          className="mt-6 rounded-md bg-neutral-900 px-5 py-2.5 text-white"
        >
          Let's talk
        </button>
      </section>
    </main>
  );
}

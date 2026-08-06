const rise = (delay) => ({
  animation: 'var(--animate-rise)',
  animationDelay: `${delay}ms`,
})

export default function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="pt-20 pb-28 md:pt-28 md:pb-36">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
        <div className="md:col-span-9">
          <h1
            id="hero-heading"
            style={rise(0)}
            className="text-[2.75rem] leading-[1.04] font-bold tracking-[-0.03em] text-balance sm:text-6xl md:text-[4.75rem]"
          >
            Product designer making complex tools feel{' '}
            <em className="font-semibold text-accent-strong">obvious</em>.
          </h1>
          <p
            style={rise(70)}
            className="mt-7 max-w-xl text-lg leading-relaxed text-ink-secondary"
          >
            Eight years shipping fintech platforms, mobile products, and design
            systems — from first sketch to measured outcome.
          </p>
          <div style={rise(140)} className="mt-9 flex flex-wrap items-center gap-4">
            <a
              href="#work"
              className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition-[background-color,box-shadow,transform] duration-150 hover:bg-accent-strong hover:shadow-card active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              View selected work
            </a>
            <a
              href="mailto:nadia@reyes.design"
              className="rounded-lg px-2 py-2.5 font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              nadia@reyes.design
            </a>
          </div>
        </div>
        <dl
          style={rise(210)}
          className="flex gap-10 self-end font-mono text-[13px] text-ink-tertiary md:col-span-3 md:flex-col md:gap-5 md:text-right"
        >
          <div>
            <dt className="text-ink-secondary">Now</dt>
            <dd>Senior PD, Meridian</dd>
          </div>
          <div>
            <dt className="text-ink-secondary">Before</dt>
            <dd>Stripe, Loom</dd>
          </div>
          <div>
            <dt className="text-ink-secondary">Based in</dt>
            <dd>Lisbon, remote-first</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

import { useReveal } from '../hooks/useReveal.js'

export default function Footer() {
  const ref = useReveal()
  return (
    <footer className="border-t border-line pt-16 pb-12">
      <div ref={ref} className="reveal">
        <h2 className="max-w-2xl text-4xl font-bold tracking-[-0.02em] text-balance sm:text-5xl">
          Hiring for a product design role? Let&rsquo;s talk.
        </h2>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href="mailto:nadia@reyes.design"
            className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition-[background-color,box-shadow,transform] duration-150 hover:bg-accent-strong hover:shadow-card active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Email nadia@reyes.design
          </a>
          <p className="text-sm text-ink-secondary">Replies within two working days.</p>
        </div>
        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 font-mono text-[13px] text-ink-tertiary">
          <p>© 2026 Nadia Reyes · Lisbon</p>
          <nav aria-label="Elsewhere" className="flex gap-6">
            <a
              href="https://www.linkedin.com/"
              className="rounded-sm transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              LinkedIn
            </a>
            <a
              href="https://read.cv/"
              className="rounded-sm transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Read.cv
            </a>
          </nav>
        </div>
      </div>
    </footer>
  )
}

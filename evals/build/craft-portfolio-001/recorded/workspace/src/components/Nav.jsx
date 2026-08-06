export default function Nav() {
  return (
    <header className="flex h-16 items-center justify-between">
      <a
        href="#main"
        className="rounded-md font-semibold tracking-tight text-ink transition-colors duration-150 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        Nadia Reyes
      </a>
      <nav aria-label="Primary" className="flex items-center gap-6">
        <span className="hidden items-center gap-2 text-sm text-ink-secondary sm:flex">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
          Open to senior roles
        </span>
        <a
          href="mailto:nadia@reyes.design"
          className="rounded-lg border border-line-strong px-3.5 py-1.5 text-sm font-medium text-ink transition-[border-color,box-shadow] duration-150 hover:border-ink hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Email me
        </a>
      </nav>
    </header>
  )
}

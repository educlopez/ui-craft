// Designer fixture: production app shell patterns (tinted sidebar, tabular-nums, semantic nav)
// Expected: high score (≥ 80) — models craft-intent product-surface discipline

interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

interface ProductShellProps {
  title: string;
  heroMetric: string;
  heroDelta: string;
  nav: NavItem[];
}

export default function ProductShell({
  title,
  heroMetric,
  heroDelta,
  nav,
}: ProductShellProps) {
  return (
    <div className="flex min-h-screen bg-[var(--gray-0)] text-[var(--gray-9)]">
      <aside
        className="w-56 shrink-0 border-r border-[var(--gray-2)] bg-[var(--gray-1)] p-4"
        aria-label="Main navigation"
      >
        <p className="text-sm font-semibold tracking-tight">Acme Ops</p>
        <nav className="mt-6 flex flex-col gap-1">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={
                item.active
                  ? "rounded-md bg-[var(--accent-tint)] px-3 py-2 text-sm font-medium text-[var(--accent)]"
                  : "rounded-md px-3 py-2 text-sm text-[var(--gray-6)] hover:bg-[var(--gray-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              }
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold">{title}</h1>
          <button
            type="button"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Export report
          </button>
        </header>
        <section
          className="mt-8 max-w-sm rounded-lg border border-[var(--gray-2)] bg-[var(--accent-tint)] p-6"
          aria-labelledby="hero-metric"
        >
          <h2 id="hero-metric" className="text-sm font-medium text-[var(--gray-6)]">
            Net revenue
          </h2>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
            {heroMetric}
          </p>
          <p className="mt-1 text-sm tabular-nums text-[var(--success)]">{heroDelta}</p>
        </section>
      </main>
    </div>
  );
}

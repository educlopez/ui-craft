/*
 * Project covers built as real mini components — actual UI fragments
 * with real values, never abstract placeholder rectangles.
 */

function Sparkline() {
  return (
    <svg viewBox="0 0 120 32" className="h-8 w-full" aria-hidden="true">
      <path
        d="M0 26 L14 22 L28 24 L42 17 L56 19 L70 12 L84 14 L98 7 L120 4"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0 26 L14 22 L28 24 L42 17 L56 19 L70 12 L84 14 L98 7 L120 4 L120 32 L0 32 Z"
        fill="url(#spark-fade)"
      />
      <defs>
        <linearGradient id="spark-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function LedgerVignette() {
  const rows = [
    { vendor: 'AWS · March invoice', amount: '$12,840.00', status: 'Matched', ok: true },
    { vendor: 'Figma · 24 seats', amount: '$1,440.00', status: 'Matched', ok: true },
    { vendor: 'Linear · annual', amount: '$3,180.00', status: 'Review', ok: false },
  ]
  return (
    <div className="w-full max-w-sm rounded-xl border border-line bg-white p-5 shadow-card">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">Reconciliation</p>
        <p className="font-mono text-[11px] text-ink-tertiary">Q1 2026</p>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">98.2%</p>
      <p className="text-sm text-ink-secondary">auto-matched, 62% faster than manual</p>
      <div className="mt-3">
        <Sparkline />
      </div>
      <ul className="mt-4 divide-y divide-line border-t border-line text-[13px]">
        {rows.map((row) => (
          <li key={row.vendor} className="flex items-center justify-between py-2">
            <span className="flex items-center gap-2 text-ink-secondary">
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${row.ok ? 'bg-accent' : 'bg-amber-500'}`}
              />
              {row.vendor}
            </span>
            <span className="font-mono tabular-nums">{row.amount}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function NorthtrailVignette() {
  return (
    <div className="w-full max-w-[280px] rounded-xl border border-line bg-white p-4 shadow-card">
      <p className="text-sm font-medium">Your next trip</p>
      <div className="mt-3 rounded-lg bg-surface p-3.5">
        <div className="flex items-baseline justify-between">
          <p className="font-semibold">Dolomites Traverse</p>
          <p className="font-mono text-[11px] text-ink-tertiary">5 days</p>
        </div>
        <p className="mt-0.5 text-[13px] text-ink-secondary">Jun 14 – 19 · 2 hikers</p>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <p className="font-mono text-sm tabular-nums">€1,240</p>
          <span className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-white">
            Confirmed
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[13px] text-ink-secondary">
        <svg viewBox="0 0 16 16" className="size-3.5 text-accent" aria-hidden="true">
          <path
            d="M3 8.5 L6.5 12 L13 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Guide assigned · offline maps ready
      </div>
    </div>
  )
}

export function PulseVignette() {
  return (
    <div className="w-full max-w-sm rounded-xl border border-line bg-white p-5 shadow-card">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">Button / primary</p>
        <p className="font-mono text-[11px] text-ink-tertiary">v3.2</p>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white">Save changes</span>
        <span className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium">Cancel</span>
      </div>
      <div className="mt-5 space-y-2 border-t border-line pt-4 font-mono text-[12px]">
        <div className="flex items-center justify-between">
          <span className="text-ink-secondary">radius.control</span>
          <span className="tabular-nums">8px</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-secondary">space.inline</span>
          <span className="tabular-nums">16px</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-secondary">color.action</span>
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="size-3 rounded-sm bg-ink" />
            ink.900
          </span>
        </div>
      </div>
    </div>
  )
}

export function CalderaVignette() {
  const steps = [
    { label: 'Connect your data source', done: true },
    { label: 'Invite your team', done: true },
    { label: 'Create your first report', done: false },
  ]
  return (
    <div className="w-full max-w-sm rounded-xl border border-line bg-white p-5 shadow-card">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">Getting started</p>
        <p className="font-mono text-[11px] text-ink-tertiary tabular-nums">2 of 3</p>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface">
        <div className="h-full w-2/3 rounded-full bg-accent" />
      </div>
      <ul className="mt-4 space-y-2.5 text-[13px]">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={`flex size-4.5 items-center justify-center rounded-full border ${
                step.done ? 'border-accent bg-accent' : 'border-line-strong bg-white'
              }`}
            >
              {step.done && (
                <svg viewBox="0 0 16 16" className="size-3 text-white">
                  <path
                    d="M3.5 8.5 L6.5 11.5 L12.5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <span className={step.done ? 'text-ink-tertiary line-through' : 'text-ink'}>
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

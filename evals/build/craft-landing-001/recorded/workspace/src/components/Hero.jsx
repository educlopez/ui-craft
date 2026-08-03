import ProductScreenshot from "./ProductScreenshot.jsx";

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-20 sm:pt-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(60%_50%_at_50%_0%,rgba(74,222,128,0.10),transparent)]"
      />

      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_1fr]">
          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal-400" />
              </span>
              Live in production since 2023
            </div>

            <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-zinc-50 sm:text-6xl">
              Every webhook, delivered exactly once.
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-zinc-400">
              Hookline sits between your services and the internet. It
              retries failed deliveries, dedupes replays, and routes events
              by payload — so your integrations stop losing webhooks and
              start syncing in real time.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#trial"
                className="inline-flex items-center justify-center rounded-lg bg-signal-500 px-5 py-3 text-sm font-medium text-zinc-950 transition-colors hover:bg-signal-400"
              >
                Start free trial
              </a>
              <a
                href="#demo"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-5 py-3 text-sm font-medium text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/5"
              >
                Watch a 2-minute demo
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M9 6l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>

            <p className="mt-5 text-sm text-zinc-500">
              No credit card required. 14-day trial, cancel anytime.
            </p>
          </div>

          <ProductScreenshot />
        </div>
      </div>
    </section>
  );
}

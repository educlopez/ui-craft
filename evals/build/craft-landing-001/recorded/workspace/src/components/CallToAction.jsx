export default function CallToAction() {
  return (
    <section id="trial" className="mx-auto max-w-6xl px-6 py-24">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 px-8 py-16 text-center shadow-panel sm:px-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full bg-[radial-gradient(50%_60%_at_50%_0%,rgba(74,222,128,0.12),transparent)]"
        />
        <h2 className="text-balance text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Stop losing webhooks to timeouts and retries you never built.
        </h2>
        <p className="mx-auto mt-4 max-w-lg leading-relaxed text-zinc-400">
          Start syncing in minutes. Point your provider at one Hookline
          endpoint and let it handle delivery, routing, and replay.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#signup"
            className="inline-flex items-center justify-center rounded-lg bg-signal-500 px-6 py-3 text-sm font-medium text-zinc-950 transition-colors hover:bg-signal-400"
          >
            Start free trial
          </a>
          <a
            href="#docs"
            className="inline-flex items-center justify-center rounded-lg border border-white/10 px-6 py-3 text-sm font-medium text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/5"
          >
            Read the docs
          </a>
        </div>
        <p className="mt-5 text-sm text-zinc-500">
          No credit card required. 14-day trial, cancel anytime.
        </p>
      </div>
    </section>
  );
}

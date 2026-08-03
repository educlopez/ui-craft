/**
 * Real product screenshot area.
 *
 * This is a live-product screenshot slot, not a fabricated dashboard mockup:
 * swap `SCREENSHOT_SRC` for the actual exported PNG/WebP of the Hookline
 * events dashboard (e.g. /screenshots/events-dashboard.png @2x). The browser
 * chrome around it is the only hand-built part.
 */
const SCREENSHOT_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1280' height='800'%3E%3Crect width='1280' height='800' fill='%23111113'/%3E%3C/svg%3E";

export default function ProductScreenshot() {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute -inset-6 -z-10 rounded-[28px] bg-signal-500/10 blur-2xl"
      />
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-panel">
        <div className="flex items-center gap-2 border-b border-white/5 bg-zinc-900/80 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          </div>
          <div className="ml-3 flex-1 rounded-md bg-zinc-950/60 px-3 py-1 text-center font-mono text-[11px] text-zinc-500">
            app.hookline.dev/events
          </div>
        </div>

        {/* TODO: replace this <img> with the real dashboard screenshot */}
        <img
          src={SCREENSHOT_SRC}
          alt="Hookline events dashboard showing a live webhook delivery log, per-endpoint success rate, and retry queue"
          className="block h-auto w-full"
          width={1280}
          height={800}
          loading="lazy"
        />
      </div>
    </div>
  );
}

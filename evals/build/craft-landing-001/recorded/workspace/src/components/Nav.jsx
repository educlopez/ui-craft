function HooklineMark() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4 4v9a5 5 0 0 0 5 5h1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M20 20v-9a5 5 0 0 0-5-5h-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="18" cy="18" r="2.25" className="fill-signal-400" stroke="none" />
    </svg>
  );
}

export default function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-2 text-zinc-100">
          <span className="text-signal-400">
            <HooklineMark />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Hookline
          </span>
        </a>

        <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          <a href="#product" className="transition-colors hover:text-zinc-100">
            Product
          </a>
          <a href="#pricing" className="transition-colors hover:text-zinc-100">
            Pricing
          </a>
          <a href="#docs" className="transition-colors hover:text-zinc-100">
            Docs
          </a>
          <a href="#changelog" className="transition-colors hover:text-zinc-100">
            Changelog
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="#signin"
            className="hidden text-sm text-zinc-400 transition-colors hover:text-zinc-100 sm:block"
          >
            Sign in
          </a>
          <a
            href="#trial"
            className="rounded-lg bg-signal-500 px-4 py-2 text-sm font-medium text-zinc-950 shadow-[0_1px_0_rgba(255,255,255,0.25)_inset] transition-colors hover:bg-signal-400"
          >
            Start free trial
          </a>
        </div>
      </div>
    </header>
  );
}

export default function Footer() {
  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <span className="text-sm font-medium text-zinc-400">Hookline</span>
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-500">
            <a href="#docs" className="transition-colors hover:text-zinc-300">
              Docs
            </a>
            <a href="#pricing" className="transition-colors hover:text-zinc-300">
              Pricing
            </a>
            <a href="#status" className="transition-colors hover:text-zinc-300">
              Status
            </a>
            <a href="#privacy" className="transition-colors hover:text-zinc-300">
              Privacy
            </a>
          </nav>
          <span className="text-sm text-zinc-600">
            &copy; {new Date().getFullYear()} Hookline, Inc.
          </span>
        </div>
      </div>
    </footer>
  );
}

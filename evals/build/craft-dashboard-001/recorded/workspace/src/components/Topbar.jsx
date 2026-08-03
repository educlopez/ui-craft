import { Search } from "lucide-react";

// 56px topbar, same surface as content, hairline border only.
export default function Topbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-2 bg-white px-6">
      <div>
        <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-gray-9">
          Work queue
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex items-center gap-2 rounded-input border border-gray-2 bg-white px-3 py-1.5 text-[13px] text-gray-6 transition-colors duration-fast hover:border-gray-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
        >
          <Search size={14} strokeWidth={1.75} aria-hidden="true" />
          <span>Search</span>
          <kbd className="rounded border border-gray-2 bg-gray-1 px-1 text-[11px] text-gray-6">
            ⌘K
          </kbd>
        </button>
      </div>
    </header>
  );
}

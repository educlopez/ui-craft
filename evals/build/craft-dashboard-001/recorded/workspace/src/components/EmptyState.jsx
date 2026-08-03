import { Inbox } from "lucide-react";

// Reachable, not decorative: shown when a filter combination returns nothing.
export default function EmptyState({ onReset }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-1 text-gray-6">
        <Inbox size={18} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <div>
        <p className="text-[14px] font-medium text-gray-9">
          Nothing here right now
        </p>
        <p className="mt-1 text-[13px] text-gray-6">
          No items match this filter. Try a different view.
        </p>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="mt-1 text-[13px] font-medium text-accent transition-colors duration-fast hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-input"
      >
        Reset filters
      </button>
    </div>
  );
}

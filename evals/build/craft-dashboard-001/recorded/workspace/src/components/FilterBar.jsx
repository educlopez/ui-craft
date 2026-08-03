// Ghost buttons for filters, accent/10 for the active one, conditional
// "Reset" text link — never a solid primary button in a toolbar.
export default function FilterBar({ filters, active, onSelect, onReset, hasCustomFilter }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-2 px-6 py-3">
      <div className="flex items-center gap-1">
        {filters.map((filter) => {
          const isActive = filter === active;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => onSelect(filter)}
              className={`rounded-input px-3 py-1.5 text-[13px] font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
                isActive
                  ? "bg-accent-tint text-accent"
                  : "text-gray-6 hover:bg-gray-1 hover:text-gray-9"
              }`}
            >
              {filter}
            </button>
          );
        })}
      </div>

      {hasCustomFilter && (
        <button
          type="button"
          onClick={onReset}
          className="text-[13px] font-medium text-gray-6 underline-offset-2 transition-colors duration-fast hover:text-gray-9 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 rounded-input"
        >
          Reset
        </button>
      )}
    </div>
  );
}

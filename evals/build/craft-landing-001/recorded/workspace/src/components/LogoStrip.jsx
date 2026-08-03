const companies = [
  { name: "Northbeam", mark: "N" },
  { name: "Ferrylane", mark: "F" },
  { name: "Cascata", mark: "C" },
  { name: "Vanterra", mark: "V" },
  { name: "Ridgepoint", mark: "R" },
];

function Monogram({ letter }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="1"
        y="1"
        width="22"
        height="22"
        rx="6"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontSize="11"
        fontFamily="Inter, sans-serif"
        fontWeight="600"
        fill="currentColor"
      >
        {letter}
      </text>
    </svg>
  );
}

export default function LogoStrip() {
  return (
    <section className="border-y border-white/5 py-10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="mb-6 text-center text-sm text-zinc-500">
          Processing webhook traffic for integration teams at
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-zinc-500">
          {companies.map((c) => (
            <div
              key={c.name}
              className="flex items-center gap-2 transition-colors hover:text-zinc-300"
            >
              <Monogram letter={c.mark} />
              <span className="text-sm font-medium">{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

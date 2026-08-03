import Sparkline from "./Sparkline.jsx";

// Two variants per the metric-card contract: primary is accent-tinted with a
// larger number, secondaries are neutral and smaller. All four get a
// sparkline and plain (non-colored) comparison text — no green/red arrows.
export default function KpiCard({ label, value, context, primary, trend }) {
  return (
    <div
      className={`flex flex-col justify-between rounded-card p-4 shadow-card ${
        primary ? "bg-accent-tint" : "bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-gray-7">{label}</p>
          <p
            className={`mt-1 font-bold tabular-nums tracking-[-0.02em] ${
              primary ? "text-[36px] text-accent" : "text-[28px] text-gray-9"
            }`}
          >
            {value}
          </p>
        </div>
        <Sparkline
          data={trend}
          color={primary ? "var(--accent)" : "var(--gray-6)"}
        />
      </div>
      <p className="mt-3 text-[12px] text-gray-6">{context}</p>
    </div>
  );
}

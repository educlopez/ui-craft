import { statusMeta } from "../data/mockData.js";

// 6px colored dot + text label — never a colored badge/pill.
export default function StatusDot({ status }) {
  const meta = statusMeta[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-gray-9">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: meta.color }}
        aria-hidden="true"
      />
      {meta.label}
    </span>
  );
}

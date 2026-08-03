const attempts = [
  { label: "Attempt 1", state: "failed", detail: "504" },
  { label: "Attempt 2", state: "failed", detail: "timeout" },
  { label: "Attempt 3", state: "success", detail: "200" },
];

export default function DeliveryTimeline() {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900 p-5 shadow-panel">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-zinc-500">
          evt_9f21ac · order.shipped
        </span>
        <span className="rounded-full bg-signal-500/10 px-2 py-0.5 font-mono text-[11px] text-signal-400">
          delivered
        </span>
      </div>

      <div className="relative mt-6 flex items-center justify-between">
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-zinc-800" />
        {attempts.map((a, i) => (
          <div key={a.label} className="relative flex flex-col items-center gap-2">
            <span
              className={
                "flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-medium " +
                (a.state === "success"
                  ? "border-signal-500/40 bg-signal-500 text-zinc-950"
                  : "border-zinc-700 bg-zinc-900 text-zinc-500")
              }
            >
              {i + 1}
            </span>
            <div className="text-center">
              <p className="text-xs font-medium text-zinc-300">{a.label}</p>
              <p className="font-mono text-[11px] text-zinc-500">{a.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

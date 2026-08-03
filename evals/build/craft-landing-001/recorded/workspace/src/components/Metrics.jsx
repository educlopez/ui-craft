const stats = [
  { value: "142ms", label: "Median delivery latency" },
  { value: "99.98%", label: "Delivery success rate" },
  { value: "4.2M", label: "Events processed per day" },
  { value: "30 days", label: "Payload retention for replay" },
];

export default function Metrics() {
  return (
    <section className="border-y border-white/5 bg-zinc-900/40">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-semibold tabular-nums tracking-tight text-zinc-50 sm:text-4xl">
                {s.value}
              </p>
              <p className="mt-2 text-sm text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

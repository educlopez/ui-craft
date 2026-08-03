const rows = [
  { id: "evt_a13f", event: "invoice.paid", status: "200", age: "2m ago" },
  { id: "evt_9c02", event: "user.updated", status: "200", age: "6m ago" },
  { id: "evt_77bd", event: "order.shipped", status: "replayed", age: "14m ago" },
];

export default function EventLog() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-panel">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/5 text-xs text-zinc-500">
            <th className="px-5 py-3 font-medium">Event</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium text-right">Age</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-white/5 last:border-0">
              <td className="px-5 py-3 font-mono text-[12.5px] text-zinc-300">
                {r.event}
              </td>
              <td className="px-5 py-3">
                <span
                  className={
                    "font-mono text-[12.5px] " +
                    (r.status === "replayed" ? "text-zinc-400" : "text-signal-400")
                  }
                >
                  {r.status}
                </span>
              </td>
              <td className="px-5 py-3 text-right font-mono text-[12.5px] text-zinc-500">
                {r.age}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

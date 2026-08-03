export default function RoutingConfig() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-panel">
      <div className="border-b border-white/5 px-5 py-3">
        <span className="font-mono text-xs text-zinc-500">routes.yaml</span>
      </div>
      <pre className="overflow-x-auto px-5 py-4 font-mono text-[12.5px] leading-relaxed text-zinc-400">
        <code>
          <span className="text-zinc-600">1</span>{"  "}
          <span className="text-signal-400">match:</span>
          {"\n"}
          <span className="text-zinc-600">2</span>{"  "}
          {"  "}event:{" "}
          <span className="text-zinc-200">"payment.failed"</span>
          {"\n"}
          <span className="text-zinc-600">3</span>{"  "}
          {"  "}region:{" "}
          <span className="text-zinc-200">"eu-*"</span>
          {"\n"}
          <span className="text-zinc-600">4</span>{"  "}
          <span className="text-signal-400">route_to:</span>
          {"\n"}
          <span className="text-zinc-600">5</span>{"  "}
          {"  "}- <span className="text-zinc-200">billing-service.eu</span>
          {"\n"}
          <span className="text-zinc-600">6</span>{"  "}
          {"  "}- <span className="text-zinc-200">fraud-review-queue</span>
        </code>
      </pre>
    </div>
  );
}

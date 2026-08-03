import DeliveryTimeline from "./DeliveryTimeline.jsx";
import RoutingConfig from "./RoutingConfig.jsx";
import EventLog from "./EventLog.jsx";

function FeatureRow({ reverse, kicker, title, body, children }) {
  return (
    <div
      className={
        "grid items-center gap-12 py-16 lg:grid-cols-2 " +
        (reverse ? "lg:[&>*:first-child]:order-2" : "")
      }
    >
      <div className="max-w-md">
        {kicker && (
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-signal-400">
            {kicker}
          </p>
        )}
        <h3 className="text-2xl font-semibold tracking-tight text-zinc-50">
          {title}
        </h3>
        <p className="mt-4 leading-relaxed text-zinc-400">{body}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function Features() {
  return (
    <section id="product" className="mx-auto max-w-6xl px-6">
      <div className="divide-y divide-white/5">
        <FeatureRow
          kicker="Reliability"
          title="Guaranteed delivery, even when your endpoint isn't."
          body="Hookline retries with exponential backoff, holds events through outages, and only marks a delivery done once your service returns 2xx. Nothing gets silently dropped."
        >
          <DeliveryTimeline />
        </FeatureRow>

        <FeatureRow
          reverse
          title="Route by payload, not just endpoint."
          body="Write routing rules against event type, region, or any field in the body. One inbound webhook can fan out to as many downstream services as you need."
        >
          <RoutingConfig />
        </FeatureRow>

        <FeatureRow
          title="Replay any event, on demand."
          body="Every payload is stored for 30 days. Debug a bad deploy or backfill a downstream service by replaying exactly what was sent — no re-triggering the source."
        >
          <EventLog />
        </FeatureRow>
      </div>
    </section>
  );
}

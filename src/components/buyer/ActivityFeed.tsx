import type { Activity } from "@/lib/buyer-shipments";
import { formatWhen } from "./format";

export function ActivityFeed({ activity, now }: { activity: Activity[]; now: number }) {
  return (
    <section className="bd-card bd-activity" aria-labelledby="bd-activity-title">
      <h2 id="bd-activity-title" className="bd-h2">
        Recent activity
      </h2>
      {activity.length === 0 ? (
        <p className="bd-muted">Handoffs, documents and approvals will show here.</p>
      ) : (
        <ol className="bd-feed">
          {activity.map((a) => (
            <li key={a.id}>
              <span className={`bd-dot bd-dot--${a.tone}`} aria-hidden="true" />
              <span className="bd-feed-text">
                <span>{a.text}</span>
                <span className="bd-small bd-muted">{formatWhen(a.at, now)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

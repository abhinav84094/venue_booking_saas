import { subscriptionValidity } from "../utils/hallSubscription";

export default function SubscriptionValidity({ subscription, timezone, compact = false }) {
  const validity = subscriptionValidity(subscription, timezone);
  return (
    <dl className={`subscription-validity ${compact ? "validity-compact" : ""}`}>
      <div>
        <dt>Current plan</dt>
        <dd>{validity.plan}</dd>
      </div>
      <div>
        <dt>Activation date</dt>
        <dd>{validity.activated}</dd>
      </div>
      <div>
        <dt>Valid until (exclusive)</dt>
        <dd>{validity.expires}</dd>
      </div>
      <div>
        <dt>Remaining validity</dt>
        <dd>
          {validity.remainingDays} {validity.remainingDays === 1 ? "day" : "days"}
        </dd>
      </div>
    </dl>
  );
}

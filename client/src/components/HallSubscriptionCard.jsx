import { Link } from "react-router-dom";
import { ArrowUpRight, Layers3, MapPin } from "lucide-react";
import { Badge } from "./ui";
import SubscriptionValidity from "./SubscriptionValidity";
import { subscriptionAction } from "../utils/hallSubscription";

export default function HallSubscriptionCard({ hall, venue, owner }) {
  const base = `/venues/${venue._id}/halls/${hall._id}`;
  const subscription = hall.subscription;
  return (
    <article className="venue-card hall-subscription-card">
      <div className="venue-card-art">
        {hall.images?.[0]?.url ? (
          <img src={hall.images[0].url} alt={hall.images[0].alt || hall.name} />
        ) : (
          <div className="venue-placeholder">
            <Layers3 size={44} />
            <span>{venue.name}</span>
          </div>
        )}
        <Badge>{subscription?.status || "pending"}</Badge>
      </div>
      <div className="hall-subscription-body">
        <p className="eyebrow">{venue.name}</p>
        <h2>{hall.name}</h2>
        <p className="venue-card-location">
          <MapPin size={14} />
          {venue.address?.city || "Venue location"}
        </p>
        <SubscriptionValidity subscription={subscription} timezone={venue.timezone} />
        <p className="muted small">Times in {venue.timezone}. Access ends at expiration.</p>
        <div className="hall-subscription-actions">
          {subscription?.dashboardAccess === true && (
            <Link className="btn btn-primary full" to={base}>
              Open dashboard <ArrowUpRight size={16} />
            </Link>
          )}
          {owner ? (
            <Link
              className={`btn btn-${subscription?.dashboardAccess ? "secondary" : "primary"} full`}
              to={`${base}/subscription`}
            >
              {subscriptionAction(subscription)}
              <ArrowUpRight size={16} />
            </Link>
          ) : (
            !subscription?.dashboardAccess && (
              <p className="muted small">Ask the venue owner to activate or renew this hall.</p>
            )
          )}
        </div>
      </div>
    </article>
  );
}

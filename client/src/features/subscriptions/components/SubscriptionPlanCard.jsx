import { ArrowUpRight, Check } from "lucide-react";
import { Button } from "../../../components/ui";
import { money } from "../../../utils/format";
export default function SubscriptionPlanCard({ plan: p, data, venue, busy, checkout }) {
  return (
    <article className="plan-card">
      <span className="eyebrow">{p.interval === "quarterly" ? "3-MONTH" : "ANNUAL"} PLAN</span>
      <h2>{p.name}</h2>
      <p className="plan-price">
        {money(p.amount)}
        <span> / {p.interval === "quarterly" ? "3 months" : "year"}</span>
      </p>
      <div className="plan-features">
        <span>
          <Check size={15} />
          {p.features.publicWebsite
            ? "Published venue website"
            : "Website publication not included"}
        </span>
        <span>
          <Check size={15} />
          {p.features.enquiries ? "Public booking enquiries" : "Public enquiries not included"}
        </span>
        <span>
          <Check size={15} />
          Existing booking management
        </span>
      </div>
      <Button
        className="full"
        disabled={
          !data.gatewayConfigured ||
          !venue.contact?.phone ||
          !venue.address?.city ||
          !venue.address?.state ||
          data.hasUncertainCheckout ||
          data.dashboardAccess ||
          ["suspended", "review_required"].includes(data.subscription?.status)
        }
        busy={busy}
        onClick={() => checkout(p._id)}
      >
        {data.dashboardAccess
          ? String(data.subscription?.planId) === p._id
            ? "Current plan"
            : "Available after expiry"
          : data.subscription?.status === "expired"
            ? "Renew plan"
            : "Choose plan & pay"}
        <ArrowUpRight size={16} />
      </Button>
    </article>
  );
}

import { Link, useOutletContext } from "react-router-dom";
import { ShieldCheck, ArrowUpRight, RefreshCw } from "lucide-react";
import { useResource } from "../hooks/useResource";
import SubscriptionPlanCard from "../features/subscriptions/components/SubscriptionPlanCard";
import SubscriptionPaymentHistory from "../features/subscriptions/components/SubscriptionPaymentHistory";
import { useSubscriptionActions } from "../features/subscriptions/hooks/useSubscriptionActions";
import { PageHeading, Loading, ErrorNotice, Notice, Empty, Button, Badge } from "../components/ui";
import SubscriptionValidity from "../components/SubscriptionValidity";
export default function SubscriptionPage() {
  const { base, venueBase, venue, hall, reloadVenue } = useOutletContext(),
    resource = useResource(`${base}/subscription`),
    { data, loading } = resource;
  const { busy, error, message, checkout, reconcile, recover } = useSubscriptionActions(
    base,
    resource.reload,
    reloadVenue,
  );
  return (
    <>
      <PageHeading
        eyebrow={venue.name}
        title={`${hall.name} · Subscription`}
        action={
          <Link className="btn btn-secondary" to={`${venueBase}/setup`}>
            Venue details
          </Link>
        }
      >
        Choose a plan for this hall. Its management dashboard opens only after verified payment and
        active validity.
      </PageHeading>
      <ErrorNotice error={error || resource.error} />
      <Notice type="success">{message}</Notice>
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            {!data.dashboardAccess && (
              <Notice type="info">
                This hall’s dashboard is locked.{" "}
                {data.subscription?.status === "expired"
                  ? "Renew its subscription to restore access. Your existing records are preserved."
                  : "Complete payment and backend verification to activate access."}
              </Notice>
            )}
            {!data.gatewayConfigured && (
              <Notice type="info">
                Subscription checkout is unavailable until the platform payment gateway is
                configured. No payment is simulated.
              </Notice>
            )}
            {(!venue.contact?.phone || !venue.address?.city || !venue.address?.state) && (
              <Notice type="info">
                Complete the business phone, city and state in{" "}
                <Link to={`${venueBase}/setup`}>Venue details</Link> before payment.
              </Notice>
            )}
            <section className="subscription-banner">
              <ShieldCheck size={32} />
              <div>
                <p className="eyebrow">YOUR CURRENT SUBSCRIPTION</p>
                <h2>{data.subscription?.planSnapshot?.name || "No plan selected"}</h2>
                <p>Subscription applies to {hall.name} only.</p>
              </div>
              <Badge>{data.subscription?.status || "pending"}</Badge>
              <Button
                variant="secondary"
                onClick={() => {
                  resource.reload();
                  reloadVenue();
                }}
              >
                <RefreshCw size={15} />
                Refresh
              </Button>
            </section>
            <section className="panel">
              <SubscriptionValidity subscription={data.subscription} timezone={venue.timezone} />
              <p className="muted small">
                Times use {venue.timezone}. The end time is exclusive: access ends at that instant.
                3-month validity is 90 days; yearly validity is 365 days from verified activation.
              </p>
              {data.dashboardAccess === true && (
                <Link className="btn btn-primary" to={base}>
                  Open dashboard
                  <ArrowUpRight size={16} />
                </Link>
              )}
            </section>
            {data.hasUncertainCheckout && (
              <Notice type="info">
                A checkout request needs provider reconciliation. No further order will be created
                while it is unresolved.{" "}
                <Button variant="secondary" busy={busy} onClick={recover}>
                  Recover checkout
                </Button>
              </Notice>
            )}
            {data.plans.length ? (
              <div className="plan-grid">
                {data.plans.map((p) => (
                  <SubscriptionPlanCard
                    key={p._id}
                    plan={p}
                    data={data}
                    venue={venue}
                    busy={busy}
                    checkout={checkout}
                  />
                ))}
              </div>
            ) : (
              <Empty icon={ShieldCheck} title="Plans are being configured.">
                The platform operator needs to configure the 3-month and 1-year subscription prices.
                Please check back once pricing is available.
              </Empty>
            )}
            <p className="muted small">
              Renewal is available after expiry and starts a fresh verified period. Expiry locks
              this hall’s dashboard and new online enquiries while preserving its records and
              published information. Other halls have independent subscriptions.
            </p>
            <SubscriptionPaymentHistory
              payments={data.payments}
              busy={busy}
              reconcile={reconcile}
            />
          </>
        )
      )}
    </>
  );
}

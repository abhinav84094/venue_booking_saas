import { Link, Navigate, useOutletContext } from "react-router-dom";
import {
  ArrowUpRight,
  Layers3,
  Inbox,
  CalendarCheck2,
  IndianRupee,
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import { useResource } from "../hooks/useResource";
import { PageHeading, Loading, ErrorNotice, Empty, Button } from "../components/ui";
import { money, dateTime } from "../utils/format";
export default function OverviewPage() {
  const { venue, hall, base, can, owner } = useOutletContext();
  const { data, loading, error, reload } = useResource(
    can("overview:read") ? `${base}/overview` : null,
  );
  if (!can("overview:read"))
    return (
      <Navigate
        to={`${base}/${can("bookings:read") ? "enquiries" : can("halls:read") ? "halls" : can("payments:read") ? "payments" : can("customers:read") ? "customers" : "no-access"}`}
        replace
      />
    );
  const stats = data?.stats;
  return (
    <>
      <PageHeading
        eyebrow="VENUE DASHBOARD"
        title={venue.name}
        action={
          owner && (
            <Link className="btn btn-primary" to={`${base}/halls`}>
              Manage this hall <ArrowUpRight size={16} />
            </Link>
          )
        }
      >
        {hall.name} · Bookings, availability and payments at a glance.
      </PageHeading>
      <ErrorNotice error={error} />
      {error && <Button onClick={reload}>Try again</Button>}
      {loading ? (
        <Loading />
      ) : (
        stats && (
          <>
            <div className="stat-grid">
              {[
                {
                  label: "Total halls",
                  value: stats.totalHalls,
                  Icon: Layers3,
                  foot: "Spaces full of possibility",
                  path: "halls",
                },
                {
                  label: "Pending enquiries",
                  value: stats.pendingEnquiries,
                  Icon: Inbox,
                  foot: "Conversations to continue",
                  path: "enquiries",
                },
                {
                  label: "Confirmed bookings",
                  value: stats.confirmedBookings,
                  Icon: CalendarCheck2,
                  foot: `${stats.upcomingEvents} upcoming events`,
                  path: "bookings",
                },
                {
                  label: "Recorded revenue",
                  value: money(stats.recordedRevenue),
                  Icon: IndianRupee,
                  foot: "Direct receipts less refunds",
                  path: "payments",
                },
              ].map(({ label, value, Icon, foot, path }) => (
                <article className="stat-card" key={label}>
                  <div>
                    <span>{label}</span>
                    <Icon size={19} />
                  </div>
                  <strong>{value}</strong>
                  <p>{foot}</p>
                  <Link to={`${base}/${path}`} aria-label={`View ${label}`}>
                    <ArrowUpRight size={17} />
                  </Link>
                </article>
              ))}
            </div>
            <div className="overview-grid">
              <section className="panel">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">ON THE HORIZON</p>
                    <h2>Upcoming celebrations</h2>
                  </div>
                  {can("bookings:read") && (
                    <Link className="text-link" to={`${base}/bookings`}>
                      View all
                      <ArrowRight size={15} />
                    </Link>
                  )}
                </div>
                {data.upcoming.length ? (
                  <div className="event-list">
                    {data.upcoming.map((b) => (
                      <article key={b._id}>
                        <span className="event-date">
                          <CalendarDays size={23} />
                        </span>
                        <div>
                          <strong>{b.eventType}</strong>
                          <p>
                            {b.hallId?.name} · {b.customerId?.name}
                          </p>
                          <span>{dateTime(b.startAt, venue.timezone)}</span>
                        </div>
                        <span className="event-amount">{money(b.pricingSnapshot.totalAmount)}</span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <Empty icon={CalendarDays} title="A little space for what’s next.">
                    Your next confirmed event will appear here.
                  </Empty>
                )}
              </section>
              <aside className="overview-aside">
                <div className="website-note">
                  <GlobeIcon />
                  <span className="eyebrow">YOUR VENUE, ONLINE</span>
                  <h2>
                    First impressions
                    <br />
                    <i>start here.</i>
                  </h2>
                  <p>
                    {venue.published
                      ? "Your website is published. Keep your spaces and story up to date."
                      : "Introduce your halls, add your favourite photos and publish when you’re ready."}
                  </p>
                  {owner && (
                    <Link className="btn btn-cream" to={`${base}/website`}>
                      Make it yours <ArrowUpRight size={16} />
                    </Link>
                  )}
                </div>
                <div className="customer-note">
                  <UsersIcon />
                  <strong>{stats.totalCustomers} customers</strong>
                  <p>Every great event starts with a conversation.</p>
                </div>
              </aside>
            </div>
          </>
        )
      )}
    </>
  );
}
function GlobeIcon() {
  return <span className="note-icon">✧</span>;
}
function UsersIcon() {
  return <span className="note-icon">◎</span>;
}

import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, LogOut } from "lucide-react";
import { useAuth } from "../context/authContext";
import { useResource } from "../hooks/useResource";
import HallSubscriptionCard from "../components/HallSubscriptionCard";
import { Brand, PageHeading, Loading, ErrorNotice, Empty, Button } from "../components/ui";
import InstallApp from "../components/pwa/InstallApp";

export default function VenuesPage() {
  const { data, loading, error, reload } = useResource("/venues");
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const venues = data?.venues || [];
  const singleVenue = venues.length === 1 ? venues[0] : null;
  useEffect(() => {
    const previous = document.title;
    document.title = singleVenue ? `${singleVenue.name} | Dashboard` : "Your venues | Prakash SaaS";
    return () => {
      document.title = previous;
    };
  }, [singleVenue]);
  return (
    <div className="workspace-home">
      <header className="workspace-header">
        <Brand />
        <div>
          {user.role === "platform_admin" && <Link to="/admin">Platform admin</Link>}
          <Link to="/account">{user.name}</Link>
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                await logout();
                navigate("/");
              } catch {
                reload();
              }
            }}
          >
            <LogOut size={17} />
            Sign out
          </Button>
        </div>
      </header>
      <main className="venues-main">
        <PageHeading
          eyebrow="YOUR VENUE DASHBOARD"
          title={singleVenue?.name || "Your venues"}
          action={
            user.role === "owner" && (
              <Link className="btn btn-primary" to="/venues/new">
                <Plus size={17} />
                Add a venue
              </Link>
            )
          }
        >
          Select a hall to manage bookings, availability and customers. View each hall’s
          subscription and validity below.
        </PageHeading>
        <InstallApp />
        <ErrorNotice error={error} />
        {error && <Button onClick={reload}>Try again</Button>}
        {loading ? (
          <Loading />
        ) : venues.length ? (
          <>
            {venues.map((venue) => (
              <section
                className="venue-section"
                key={venue._id}
                aria-label={`Halls at ${venue.name}`}
              >
                <header className="venue-section-heading">
                  <div>
                    <h2>{singleVenue ? "Your halls" : venue.name}</h2>
                    <p className="muted">
                      {venue.halls?.length || 0} halls ·{" "}
                      {venue.address?.city ? `${venue.address.city} · ` : ""}
                      {venue.timezone}
                    </p>
                  </div>
                  <div className="hall-subscription-actions">
                    {venue.access.role === "owner" && (
                      <Link className="btn btn-secondary" to={`/venues/${venue._id}/setup`}>
                        Venue details
                      </Link>
                    )}
                    <Link className="btn btn-secondary" to={`/venues/${venue._id}/halls`}>
                      {venue.access.role === "owner" ? "Select or add hall" : "Select hall"}
                    </Link>
                  </div>
                </header>
                {venue.halls?.length ? (
                  <div className="venue-grid">
                    {venue.halls.map((hall) => (
                      <HallSubscriptionCard
                        key={hall._id}
                        hall={hall}
                        venue={venue}
                        owner={venue.access.role === "owner"}
                      />
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="Add your first hall."
                    action={
                      venue.access.role === "owner" && (
                        <Link className="btn btn-primary" to={`/venues/${venue._id}/halls`}>
                          Add a hall <Plus size={16} />
                        </Link>
                      )
                    }
                  >
                    Set up a hall at {venue.name} to view its subscription and get started.
                  </Empty>
                )}
              </section>
            ))}
          </>
        ) : (
          !error && (
            <Empty
              title="Your first venue starts here."
              action={
                user.role === "owner" && (
                  <Link className="btn btn-primary" to="/venues/new">
                    Create your venue
                    <Plus size={16} />
                  </Link>
                )
              }
            >
              Complete your venue details, create a hall and choose its subscription.
            </Empty>
          )
        )}
        <div className="workspace-home-note">
          <span>INDEPENDENT SPACES. CLEAR VALIDITY.</span>
          <p>
            Payment and renewal apply to one hall at a time.
            <br />
            Your hall details and records are preserved when a subscription expires.
          </p>
        </div>
      </main>
    </div>
  );
}

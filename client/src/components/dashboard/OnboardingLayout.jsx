import { Link, Outlet, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useResource } from "../../hooks/useResource";
import { Brand, Button, ErrorNotice, Loading } from "../ui";

export default function OnboardingLayout() {
  const { venueId } = useParams();
  const venueBase = `/venues/${venueId}`;
  const resource = useResource(venueBase);
  return (
    <div className="create-page">
      <header className="workspace-header">
        <Brand />
        <Link className="text-link" to="/venues">
          <ArrowLeft size={16} />
          All halls
        </Link>
      </header>
      <main className="create-main">
        {resource.loading ? (
          <Loading />
        ) : resource.error ? (
          <>
            <ErrorNotice error={resource.error} />
            <Button onClick={resource.reload}>Try again</Button>
          </>
        ) : (
          resource.data && (
            <>
              <nav className="onboarding-nav" aria-label="Venue setup">
                {resource.data.access.role === "owner" && (
                  <Link to={`${venueBase}/setup`}>Venue details</Link>
                )}
                <Link to={`${venueBase}/halls`}>Halls & subscriptions</Link>
                <Link to="/account">Your account</Link>
              </nav>
              <Outlet
                context={{
                  ...resource.data,
                  owner: resource.data.access.role === "owner",
                  base: venueBase,
                  venueBase,
                  onboarding: true,
                  reloadVenue: resource.reload,
                }}
              />
            </>
          )
        )}
      </main>
    </div>
  );
}

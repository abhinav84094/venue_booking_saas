import { Link, Outlet, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useResource } from "../../hooks/useResource";
import { Brand, Button, ErrorNotice, Loading, Notice } from "../ui";

export default function SubscriptionLayout() {
  const { venueId, hallId } = useParams();
  const base = `/venues/${venueId}/halls/${hallId}`;
  const resource = useResource(`${base}/access`);
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
          resource.data &&
          (resource.data.access.role !== "owner" ? (
            <Notice>Only the venue owner can manage this hall’s subscription.</Notice>
          ) : (
            <Outlet
              context={{
                ...resource.data,
                owner: true,
                base,
                venueBase: `/venues/${venueId}`,
                reloadVenue: resource.reload,
              }}
            />
          ))
        )}
      </main>
    </div>
  );
}

import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Plus, Layers3 } from "lucide-react";
import HallEditor from "../features/halls/components/HallEditor";
import HallCard from "../features/halls/components/HallCard";
import { useResource } from "../hooks/useResource";
import { PageHeading, Loading, ErrorNotice, Notice, Empty, Button } from "../components/ui";
export default function HallsPage({ pricingOnly = false }) {
  const { venueBase, base, owner, reloadVenue } = useOutletContext(),
    { data, loading, error, reload } = useResource(`${base}/halls`),
    [editing, setEditing] = useState(null),
    [notice, setNotice] = useState("");
  return (
    <>
      <PageHeading
        eyebrow="EVERY SPACE HAS A STORY"
        title={pricingOnly ? "Pricing, on your terms." : "Make room for every occasion."}
        action={
          owner &&
          !pricingOnly && (
            <Link className="btn btn-secondary" to={`${venueBase}/halls`}>
              <Plus size={17} />
              Switch or add hall
            </Link>
          )
        }
      >
        {pricingOnly
          ? "Set rates for each hall. All amounts are calculated and stored securely on the server."
          : "Manage this hall’s capacity, amenities and rates. Other halls have independent dashboards and subscriptions."}
      </PageHeading>
      <ErrorNotice error={error} />
      <Notice type="success">{notice}</Notice>
      {error && <Button onClick={reload}>Try again</Button>}
      {editing ? (
        <HallEditor
          key={editing._id || "new"}
          initial={editing}
          base={base}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setNotice("Hall and pricing saved.");
            reload();
            reloadVenue();
          }}
        />
      ) : loading ? (
        <Loading />
      ) : data?.halls.length ? (
        <div className="hall-grid">
          {data.halls.map((h) => (
            <HallCard
              key={h._id}
              hall={h}
              owner={owner}
              pricingOnly={pricingOnly}
              onEdit={setEditing}
            />
          ))}
        </div>
      ) : (
        !error && (
          <Empty
            icon={Layers3}
            title="Every great venue starts with a space."
            action={
              owner && (
                <Link className="btn btn-primary" to={`${venueBase}/halls`}>
                  <Plus size={16} />
                  Choose a hall
                </Link>
              )
            }
          >
            Introduce a hall, add its capacity and configure the rates you want to offer.
          </Empty>
        )
      )}
    </>
  );
}

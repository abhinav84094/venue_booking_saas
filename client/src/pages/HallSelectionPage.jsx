import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Plus, ArrowRight } from "lucide-react";
import api from "../services/api";
import { useResource } from "../hooks/useResource";
import HallSubscriptionCard from "../components/HallSubscriptionCard";
import { PageHeading, Button, Field, ErrorNotice, Loading, Empty } from "../components/ui";

export default function HallSelectionPage() {
  const { venue, venueBase, owner } = useOutletContext();
  const resource = useResource(`${venueBase}/halls`);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", capacity: 100 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function createHall(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post(`${venueBase}/halls`, {
        name: form.name,
        capacity: Number(form.capacity),
      });
      navigate(`${venueBase}/halls/${data.hall._id}/subscription`);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow={venue.name}
        title="Choose your hall."
        action={
          owner && (
            <Button onClick={() => setCreating(!creating)}>
              <Plus size={17} />
              Add a hall
            </Button>
          )
        }
      >
        Each hall has its own subscription and validity. Complete payment to open its dashboard.
      </PageHeading>
      <ErrorNotice error={error || resource.error} />
      {creating && owner && (
        <form className="panel form-stack" onSubmit={createHall}>
          <h2>Introduce your hall</h2>
          <div className="form-grid">
            <Field
              label="Hall name"
              required
              minLength={2}
              maxLength={120}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <Field
              label="Guest capacity"
              required
              type="number"
              min={1}
              max={100000}
              value={form.capacity}
              onChange={(event) => setForm({ ...form, capacity: event.target.value })}
            />
          </div>
          <p className="muted small">
            Choose a plan next. Hall pricing, photos and bookings become available after verified
            activation.
          </p>
          <div className="form-footer">
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" busy={busy}>
              Create hall & choose plan
              <ArrowRight size={16} />
            </Button>
          </div>
        </form>
      )}
      {resource.loading ? (
        <Loading />
      ) : resource.data?.halls.length ? (
        <div className="venue-grid">
          {resource.data.halls.map((hall) => (
            <HallSubscriptionCard key={hall._id} hall={hall} venue={venue} owner={owner} />
          ))}
        </div>
      ) : (
        !resource.error && (
          <Empty
            title="Your first hall starts here."
            action={
              owner && (
                <Button onClick={() => setCreating(true)}>
                  <Plus size={16} />
                  Add your first hall
                </Button>
              )
            }
          >
            Create your space, choose its subscription and complete payment.
          </Empty>
        )
      )}
    </>
  );
}

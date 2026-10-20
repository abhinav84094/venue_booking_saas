import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Inbox } from "lucide-react";
import { useResource } from "../hooks/useResource";
import BookingCard from "../features/bookings/components/BookingCard";
import { useBookingActions } from "../features/bookings/hooks/useBookingActions";
import {
  PageHeading,
  Loading,
  ErrorNotice,
  Notice,
  Empty,
  Button,
  SelectField,
} from "../components/ui";
export default function BookingsPage({ confirmed = false }) {
  const { base, can } = useOutletContext(),
    [status, setStatus] = useState(confirmed ? "CONFIRMED" : ""),
    [page, setPage] = useState(1);
  const resource = useResource(
      `${base}/bookings?page=${page}&limit=25${status ? `&status=${status}` : ""}`,
    ),
    { data, loading } = resource;
  const { busy, error, message, transition } = useBookingActions(base, resource.reload);
  return (
    <>
      <PageHeading
        eyebrow={confirmed ? "IT’S ON THE CALENDAR" : "FROM CONVERSATIONS TO CELEBRATIONS"}
        title={confirmed ? "The moments ahead." : "Your booking requests."}
      >
        Review enquiries and guide each event from its first hello to its final celebration.
      </PageHeading>
      <div className="toolbar">
        <SelectField
          label="Booking status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All bookings</option>
          {["ENQUIRY", "PENDING", "CONFIRMED", "COMPLETED", "REJECTED", "CANCELLED", "EXPIRED"].map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </SelectField>
        <p className="muted small">
          Enquiries do not reserve a hall. Confirmation secures the time.
        </p>
      </div>
      <ErrorNotice error={error || resource.error} />
      <Notice type="success">{message}</Notice>
      {resource.error && <Button onClick={resource.reload}>Try again</Button>}
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        <>
          <div className="booking-list">
            {data.items.map((b) => (
              <BookingCard key={b._id} booking={b} can={can} busy={busy} transition={transition} />
            ))}
          </div>
          <div className="pagination">
            <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span>
              Page {page} · {data.total} bookings
            </span>
            <Button
              variant="secondary"
              disabled={page * 25 >= data.total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </>
      ) : (
        !resource.error && (
          <Empty icon={Inbox} title="A little quiet before the celebration.">
            Booking enquiries for your venue will appear here. Publish your website to start the
            conversation.
          </Empty>
        )
      )}
    </>
  );
}

import { Check, ArrowRight, X, CalendarCheck2 } from "lucide-react";
import { Button, Badge } from "../../../components/ui";
import { money, dateTime } from "../../../utils/format";
export default function BookingCard({ booking: b, can, busy, transition }) {
  return (
    <article className="booking-card panel">
      <div className="section-title">
        <div>
          <span className="eyebrow">{b.reference}</span>
          <h2>{b.eventType}</h2>
        </div>
        <Badge>{b.status}</Badge>
      </div>
      <div className="booking-details">
        <div>
          <span>CUSTOMER</span>
          <strong>{b.customerId?.name || "Customer"}</strong>
          <a href={`tel:${b.customerId?.phone}`}>{b.customerId?.phone}</a>
          {b.customerId?.email && <a href={`mailto:${b.customerId.email}`}>{b.customerId.email}</a>}
        </div>
        <div>
          <span>THE SPACE & TIME</span>
          <strong>
            {b.hallId?.name} · {b.guests} guests
          </strong>
          <p>{dateTime(b.startAt, b.timezone)}</p>
          <p>to {dateTime(b.endAt, b.timezone)}</p>
          <small>{b.timezone}</small>
        </div>
        <div>
          <span>BOOKING QUOTE</span>
          <strong>{money(b.pricingSnapshot.totalAmount)}</strong>
          <p>{b.pricingSnapshot.label}</p>
          <p>Balance: {money(b.paymentState.balanceAmount)}</p>
          <small>{b.paymentState.status.toLowerCase()}</small>
        </div>
      </div>
      {b.notes && <p className="booking-notes">{b.notes}</p>}
      {["ENQUIRY", "PENDING"].includes(b.status) && (
        <p className="muted small">
          Respond by {dateTime(b.enquiryExpiresAt, b.timezone)}. Quotes are saved at enquiry time.
        </p>
      )}
      {can("bookings:write") && (
        <div className="booking-actions">
          {b.status === "ENQUIRY" && (
            <Button
              variant="secondary"
              busy={busy === b._id}
              onClick={() => transition(b._id, "PENDING")}
            >
              Mark pending <ArrowRight size={14} />
            </Button>
          )}
          {["ENQUIRY", "PENDING"].includes(b.status) && (
            <>
              <Button busy={busy === b._id} onClick={() => transition(b._id, "CONFIRMED")}>
                <Check size={15} />
                Confirm booking
              </Button>
              <Button
                variant="ghost"
                busy={busy === b._id}
                onClick={() => transition(b._id, "REJECTED")}
              >
                <X size={15} />
                Reject
              </Button>
            </>
          )}
          {b.status === "CONFIRMED" && new Date(b.endAt) <= new Date() && (
            <Button busy={busy === b._id} onClick={() => transition(b._id, "COMPLETED")}>
              <CalendarCheck2 size={15} />
              Mark completed
            </Button>
          )}
          {["ENQUIRY", "PENDING", "CONFIRMED"].includes(b.status) && (
            <Button
              variant="ghost"
              busy={busy === b._id}
              onClick={() => transition(b._id, "CANCELLED")}
            >
              Cancel booking
            </Button>
          )}
        </div>
      )}
      <details className="booking-history">
        <summary>Booking history</summary>
        {b.history.map((h, i) => (
          <p key={i}>
            <Badge>{h.status}</Badge> {dateTime(h.at, b.timezone)}
          </p>
        ))}
      </details>
    </article>
  );
}

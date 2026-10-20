import { Trash2 } from "lucide-react";
import { Button } from "../../../components/ui";
import { dateTime } from "../../../utils/format";
export default function AvailabilityDayDetails({ selectedDay, forDay, venue, can, busy, remove }) {
  if (!selectedDay) return null;
  return (
    <section className="panel calendar-details">
      <h2>{selectedDay}</h2>
      {forDay(selectedDay).length ? (
        forDay(selectedDay).map((b, i) => (
          <div className="availability-row" key={b._id || i}>
            <div>
              <strong>
                {b.type === "BOOKING" ? "Confirmed event" : b.reason || "Unavailable"}
              </strong>
              <p>
                {dateTime(b.startAt, venue.timezone)} → {dateTime(b.endAt, venue.timezone)}
              </p>
            </div>
            {b._id && can("bookings:write") && (
              <Button
                variant="ghost"
                busy={busy}
                onClick={() => remove(b._id)}
                aria-label="Remove unavailable period"
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        ))
      ) : (
        <p className="muted">No confirmed events or blocks on this day.</p>
      )}
    </section>
  );
}

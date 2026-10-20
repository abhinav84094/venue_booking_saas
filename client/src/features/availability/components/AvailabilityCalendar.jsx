import { Loading } from "../../../components/ui";
export default function AvailabilityCalendar({
  year,
  mo,
  month,
  offset,
  days,
  selectedDay,
  setSelectedDay,
  forDay,
  loading,
}) {
  return (
    <section className="panel calendar-panel">
      <div className="section-title">
        <h2>
          {new Date(Date.UTC(year, mo - 1, 1)).toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        </h2>
        <span className="muted small">Select a day for details</span>
      </div>
      <div className="calendar-grid" aria-label="Hall availability calendar">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <span className="calendar-weekday" key={d}>
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <div className="calendar-pad" key={`pad${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, "0")}`,
            items = forDay(day);
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`calendar-day ${selectedDay === day ? "selected" : ""} ${items.length ? "has-events" : ""}`}
              aria-label={`${day}: ${items.length} events or blocks`}
            >
              <span>{i + 1}</span>
              <div>
                {items.slice(0, 2).map((b, n) => (
                  <span
                    key={n}
                    className={b.type === "BOOKING" ? "calendar-event" : "calendar-block"}
                  >
                    {b.type === "BOOKING" ? "Event" : "Blocked"}
                  </span>
                ))}
                {items.length > 2 && <small>+{items.length - 2} more</small>}
              </div>
            </button>
          );
        })}
      </div>
      {loading && <Loading text="Loading availability…" />}
    </section>
  );
}

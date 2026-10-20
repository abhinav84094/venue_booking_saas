import { useOutletContext } from "react-router-dom";
import { CalendarDays, Plus } from "lucide-react";
import {
  PageHeading,
  Loading,
  ErrorNotice,
  Notice,
  Empty,
  Button,
  Field,
  SelectField,
} from "../components/ui";
import { useAvailability } from "../features/availability/hooks/useAvailability";
import AvailabilityCalendar from "../features/availability/components/AvailabilityCalendar";
import AvailabilityDayDetails from "../features/availability/components/AvailabilityDayDetails";
import AvailabilityBlockForm from "../features/availability/components/AvailabilityBlockForm";
export default function AvailabilityPage() {
  const { base, venue, can } = useOutletContext();
  const {
    halls,
    setHallId,
    month,
    setMonth,
    selectedHall,
    year,
    mo,
    days,
    offset,
    availability,
    showBlock,
    setShowBlock,
    error,
    message,
    busy,
    selectedDay,
    setSelectedDay,
    block,
    setBlock,
    saveBlock,
    remove,
    forDay,
  } = useAvailability(base, venue);
  return (
    <>
      <PageHeading
        eyebrow="MAKE SPACE WITH CONFIDENCE"
        title="Your availability, at a glance."
        action={
          can("bookings:write") &&
          selectedHall && (
            <Button onClick={() => setShowBlock(!showBlock)}>
              <Plus size={17} />
              Block time
            </Button>
          )
        }
      >
        Confirmed events and unavailable periods for each hall. All times use {venue.timezone}.
      </PageHeading>
      <ErrorNotice error={error || halls.error || availability.error} />
      <Notice type="success">{message}</Notice>
      {halls.loading ? (
        <Loading />
      ) : !halls.data?.halls.length ? (
        <Empty icon={CalendarDays} title="Add a hall to start your calendar.">
          Each hall has its own independent availability.
        </Empty>
      ) : (
        <>
          <div className="toolbar">
            <SelectField
              label="Event space"
              value={selectedHall}
              onChange={(e) => setHallId(e.target.value)}
            >
              {halls.data.halls.map((h) => (
                <option value={h._id} key={h._id}>
                  {h.name}
                </option>
              ))}
            </SelectField>
            <Field
              label="Month"
              type="month"
              value={month}
              required
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
            <div className="calendar-legend">
              <span>
                <i className="legend-event" />
                Event
              </span>
              <span>
                <i className="legend-block" />
                Unavailable
              </span>
            </div>
          </div>
          {showBlock && (
            <AvailabilityBlockForm
              venue={venue}
              block={block}
              setBlock={setBlock}
              saveBlock={saveBlock}
              busy={busy}
              onClose={() => setShowBlock(false)}
            />
          )}
          <AvailabilityCalendar
            year={year}
            mo={mo}
            month={month}
            offset={offset}
            days={days}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            forDay={forDay}
            loading={availability.loading}
          />
          <AvailabilityDayDetails
            selectedDay={selectedDay}
            forDay={forDay}
            venue={venue}
            can={can}
            busy={busy}
            remove={remove}
          />
          <p className="muted small">
            Enquiries and pending requests do not reserve time. Concurrent confirmations and blocks
            are checked again by the server.
          </p>
        </>
      )}
    </>
  );
}

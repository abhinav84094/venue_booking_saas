import { ArrowUpRight, CalendarDays } from "lucide-react";
import { Notice, Button, ErrorNotice, SelectField, Field, TextArea } from "../../../components/ui";
import { money } from "../../../utils/format";
import { usePublicEnquiry } from "../hooks/usePublicEnquiry";
import EnquiryReceipt from "./EnquiryReceipt";

export default function EnquiryForm({ slug, venue, halls, selectedHall }) {
  const {
    form,
    setForm,
    hall,
    quoteKey,
    currentQuote,
    availability,
    result,
    setResult,
    setQuote,
    busy,
    error,
    set,
    startTime,
    getQuote,
    submit,
    refreshReceipt,
  } = usePublicEnquiry({ slug, halls, selectedHall });
  if (!hall)
    return (
      <Notice type="info">
        This venue will be adding its event spaces soon. Please get in touch directly.
      </Notice>
    );
  if (result)
    return (
      <EnquiryReceipt
        result={result}
        error={error}
        busy={busy}
        refreshReceipt={refreshReceipt}
        onReset={() => {
          setResult(null);
          setQuote(null);
        }}
      />
    );
  return (
    <form className="enquiry-form form-stack" onSubmit={submit}>
      <ErrorNotice error={error} />
      <SelectField
        label="Your preferred space"
        value={form.hallId}
        onChange={(e) => {
          const h = halls.find((v) => v._id === e.target.value);
          setForm({ ...form, hallId: h._id, model: h.pricing[0]?.key || "" });
        }}
      >
        {halls.map((h) => (
          <option value={h._id} key={h._id}>
            {h.name} · up to {h.capacity} guests
            {h.enquiriesEnabled !== true ? " · online booking unavailable" : ""}
          </option>
        ))}
      </SelectField>
      {hall.enquiriesEnabled !== true ? (
        <Notice type="info">
          Online booking is currently unavailable for this hall. Please use the venue’s contact
          details to discuss your event.
        </Notice>
      ) : (
        <>
          <SelectField
            label="Booking option"
            required
            value={form.model}
            onChange={(e) => set("model", e.target.value)}
          >
            {hall.pricing.map((r) => (
              <option value={r.key} key={r.key}>
                {r.label}
                {r.key === "HOURLY" ? " (per hour)" : ""}
              </option>
            ))}
          </SelectField>
          <div className="form-grid">
            <Field
              label="From"
              type="datetime-local"
              step={60}
              required
              value={form.startAt}
              onChange={(e) => startTime(e.target.value)}
            />
            <Field
              label="Until"
              type="datetime-local"
              step={60}
              required
              value={form.endAt}
              onChange={(e) => set("endAt", e.target.value)}
            />
          </div>
          <p className="muted small">
            {venue.timezone} ·{" "}
            {form.model === "FULL_DAY"
              ? "Full day: local midnight to the next midnight."
              : form.model === "HALF_DAY"
                ? `Duration: ${hall.pricing.find((r) => r.key === form.model)?.durationMinutes} minutes.`
                : `Maximum duration: ${hall.pricing.find((r) => r.key === form.model)?.durationMinutes} minutes.`}{" "}
            Date overrides use the event’s start date.
          </p>
          <Button variant="secondary" type="button" busy={busy} onClick={getQuote}>
            <CalendarDays size={16} />
            Check availability & quote
          </Button>
          {currentQuote && (
            <div className="quote-result">
              <span>Your booking quote</span>
              <strong>{money(currentQuote.totalAmount)}</strong>
              <small>
                {currentQuote.label}
                {currentQuote.units > 1 ? ` · ${currentQuote.units} hours` : ""}
              </small>
            </div>
          )}
          {availability?.key === quoteKey && (
            <Notice type={availability.value.busy.length ? "error" : "success"}>
              {availability.value.busy.length
                ? "This time range includes a confirmed event or unavailable period. Please choose another time."
                : "No confirmed events or blocks in this range. Availability is checked again at confirmation."}
            </Notice>
          )}
          <div className="form-grid">
            <Field
              label="Your name"
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              value={form.customer.name}
              onChange={(e) => set("customer", { ...form.customer, name: e.target.value })}
            />
            <Field
              label="Phone number"
              type="tel"
              required
              autoComplete="tel"
              value={form.customer.phone}
              onChange={(e) => set("customer", { ...form.customer, phone: e.target.value })}
            />
            <Field
              label="Email (optional)"
              type="email"
              autoComplete="email"
              value={form.customer.email}
              onChange={(e) => set("customer", { ...form.customer, email: e.target.value })}
            />
            <Field
              label="Occasion / event type"
              required
              minLength={2}
              maxLength={100}
              placeholder="Wedding, conference, celebration…"
              value={form.eventType}
              onChange={(e) => set("eventType", e.target.value)}
            />
            <Field
              label="Number of guests"
              type="number"
              required
              min={1}
              max={hall.capacity}
              value={form.guests}
              onChange={(e) => set("guests", e.target.value)}
            />
          </div>
          <TextArea
            label="Anything you’d like us to know?"
            maxLength={2000}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
          <Button
            type="submit"
            className="btn-venue full"
            busy={busy}
            disabled={
              !currentQuote ||
              Boolean(availability?.key === quoteKey && availability.value.busy.length)
            }
          >
            Send your enquiry
            <ArrowUpRight size={17} />
          </Button>
          <p className="muted small">
            Your details are shared privately with this venue to respond to your event enquiry. No
            customer account or online payment is required.
          </p>
        </>
      )}
    </form>
  );
}

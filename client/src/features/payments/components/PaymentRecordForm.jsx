import { Button, Field, SelectField } from "../../../components/ui";
import { money } from "../../../utils/format";
export default function PaymentRecordForm({
  save,
  bookingReference,
  setBookingReference,
  busy,
  findBooking,
  availableBookings,
  form,
  setForm,
  selected,
  onClose,
}) {
  return (
    <form onSubmit={save} className="panel form-stack">
      <h2>Keep the details together.</h2>
      <div className="inline-fields">
        <Field
          label="Find an older booking by reference"
          placeholder="VB-…"
          value={bookingReference}
          onChange={(e) => setBookingReference(e.target.value)}
        />
        <Button variant="secondary" busy={busy} disabled={!bookingReference} onClick={findBooking}>
          Find booking
        </Button>
      </div>
      <div className="form-grid">
        <SelectField
          label="Booking"
          required
          value={form.bookingId}
          onChange={(e) => setForm({ ...form, bookingId: e.target.value })}
        >
          <option value="">Select a booking</option>
          {availableBookings
            .filter((b) => ["CONFIRMED", "COMPLETED", "CANCELLED"].includes(b.status))
            .map((b) => (
              <option key={b._id} value={b._id}>
                {b.reference} · {b.customerId?.name}
              </option>
            ))}
        </SelectField>
        <SelectField
          label="Record type"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          <option value="RECEIPT">Receipt / advance</option>
          <option value="REFUND">Refund paid</option>
        </SelectField>
        <Field
          label="Amount (₹)"
          type="number"
          required
          min="0.01"
          step="0.01"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <SelectField
          label="Payment method"
          value={form.method}
          onChange={(e) => setForm({ ...form, method: e.target.value })}
        >
          {["bank_transfer", "upi", "cash", "other"].map((m) => (
            <option key={m} value={m}>
              {m.replaceAll("_", " ")}
            </option>
          ))}
        </SelectField>
        <Field
          label="Receipt / transaction reference"
          required
          minLength={2}
          maxLength={150}
          value={form.reference}
          onChange={(e) => setForm({ ...form, reference: e.target.value })}
        />
      </div>
      {selected && (
        <p className="muted">
          Quoted: {money(selected.pricingSnapshot.totalAmount)} · Recorded net:{" "}
          {money(selected.paymentState.netAmount)} · Remaining:{" "}
          {money(selected.paymentState.balanceAmount)}
        </p>
      )}
      <div className="form-footer">
        <Button variant="secondary" type="button" onClick={onClose}>
          Close
        </Button>
        <Button busy={busy} type="submit">
          Save payment record
        </Button>
      </div>
      <p className="muted small">
        Choose a recent booking or find any older booking by reference. Receipts require a confirmed
        or completed booking. Refunds cannot exceed recorded receipts.
      </p>
    </form>
  );
}

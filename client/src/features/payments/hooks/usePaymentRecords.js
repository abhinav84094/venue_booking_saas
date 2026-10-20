import { useRef, useState } from "react";
import api from "../../../services/api";
import { toPaise } from "../../../utils/format";
export function usePaymentRecords(base, resource, bookings) {
  const [open, setOpen] = useState(false),
    [form, setForm] = useState({
      bookingId: "",
      type: "RECEIPT",
      amount: "",
      method: "bank_transfer",
      reference: "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [message, setMessage] = useState("");
  const [bookingReference, setBookingReference] = useState(""),
    [foundBooking, setFoundBooking] = useState(null);
  const availableBookings = [
    ...(bookings.data?.items || []),
    ...(foundBooking && !bookings.data?.items.some((b) => b._id === foundBooking._id)
      ? [foundBooking]
      : []),
  ];
  async function findBooking() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.get(`${base}/bookings`, {
        params: { reference: bookingReference.trim().toUpperCase(), limit: 1 },
      });
      if (!data.items.length) throw new Error("No booking found with this reference.");
      setFoundBooking(data.items[0]);
      setForm({ ...form, bookingId: data.items[0]._id });
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  const idempotency = useRef({ key: crypto.randomUUID(), body: "" });
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const input = { ...form, amount: toPaise(form.amount) };
      const body = JSON.stringify(input);
      if (body !== idempotency.current.body)
        idempotency.current = { key: crypto.randomUUID(), body };
      await api.post(`${base}/payments`, { ...input, idempotencyKey: idempotency.current.key });
      idempotency.current = { key: crypto.randomUUID(), body: "" };
      setOpen(false);
      setMessage("Payment recorded. This is a record of money paid directly to your venue.");
      resource.reload();
      bookings.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const selected = availableBookings.find((b) => b._id === form.bookingId);
  return {
    open,
    setOpen,
    form,
    setForm,
    busy,
    error,
    message,
    bookingReference,
    setBookingReference,
    availableBookings,
    selected,
    findBooking,
    save,
  };
}

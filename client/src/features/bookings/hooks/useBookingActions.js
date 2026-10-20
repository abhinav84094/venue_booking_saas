import { useState } from "react";
import api from "../../../services/api";
export function useBookingActions(base, reload) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  async function transition(id, next) {
    setBusy(id);
    setError(null);
    setMessage("");
    try {
      await api.patch(`${base}/bookings/${id}`, { status: next });
      reload();
      setMessage(`Booking updated to ${next.toLowerCase()}.`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy("");
    }
  }
  return { busy, error, message, transition };
}

import { useState } from "react";
import api from "../../../services/api";

export function usePublicEnquiry({ slug, halls, selectedHall }) {
  const first =
    halls.find((h) => h._id === selectedHall) ||
    halls.find((h) => h.enquiriesEnabled === true) ||
    halls[0];
  const [form, setForm] = useState({
      hallId: first?._id || "",
      model: first?.pricing[0]?.key || "",
      startAt: "",
      endAt: "",
      customer: { name: "", phone: "", email: "" },
      eventType: "",
      guests: "",
      notes: "",
    }),
    [quote, setQuote] = useState(null),
    [availability, setAvailability] = useState(null),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const hall = halls.find((h) => h._id === form.hallId),
    range = { model: form.model, startAt: form.startAt, endAt: form.endAt },
    quoteKey = JSON.stringify({ hallId: form.hallId, ...range }),
    currentQuote = quote?.key === quoteKey ? quote.value : null;
  const set = (key, value) => setForm({ ...form, [key]: value });
  function startTime(value) {
    if (form.model === "FULL_DAY" && value) {
      const date = value.slice(0, 10),
        d = new Date(`${date}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      setForm({
        ...form,
        startAt: `${date}T00:00`,
        endAt: `${d.toISOString().slice(0, 10)}T00:00`,
      });
    } else set("startAt", value);
  }
  async function getQuote() {
    setBusy(true);
    setError(null);
    setQuote(null);
    setAvailability(null);
    try {
      if (hall.enquiriesEnabled !== true)
        throw new Error("Online booking is currently unavailable for this hall.");
      if (!form.startAt || !form.endAt) throw new Error("Choose a start and end time first.");
      const { data } = await api.post(`/public/venues/${slug}/halls/${form.hallId}/quote`, range);
      const response = await api.get(`/public/venues/${slug}/halls/${form.hallId}/availability`, {
        params: { startAt: form.startAt, endAt: form.endAt },
      });
      setQuote({ key: quoteKey, value: data.quote.pricingSnapshot });
      setAvailability({ key: quoteKey, value: response.data });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (hall.enquiriesEnabled !== true)
        throw new Error("Online booking is currently unavailable for this hall.");
      if (!currentQuote) throw new Error("Request a fresh quote before sending your enquiry.");
      const { data } = await api.post(`/public/venues/${slug}/enquiries`, {
        ...form,
        guests: Number(form.guests),
        expectedTotalAmount: currentQuote.totalAmount,
      });
      setResult(data.enquiry);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function refreshReceipt() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post(`/public/venues/${slug}/enquiries/status`, {
        reference: result.reference,
        token: result.statusToken,
      });
      setResult((previous) => ({ ...previous, ...data.receipt }));
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return {
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
  };
}

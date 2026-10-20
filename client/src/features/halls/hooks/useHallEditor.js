import { useState } from "react";
import { toPaise } from "../../../utils/format";
import { saveHall } from "../services/hallApi";
export function useHallEditor(initial, base, onSaved) {
  const [form, setForm] = useState(() => ({
      ...initial,
      facilitiesText: initial.facilities.join(", "),
      pricing: initial.pricing.map((r) => ({
        ...r,
        amount: String(r.amount / 100),
        weekendAmount: r.weekendAmount == null ? "" : String(r.weekendAmount / 100),
        overrides: r.overrides.map((o) => ({
          startDate: o.startDate,
          endDate: o.endDate,
          amount: String(o.amount / 100),
        })),
      })),
    })),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });
  const updateRate = (index, key, value) =>
    setForm((f) => ({
      ...f,
      pricing: f.pricing.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    }));
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const input = {
        name: form.name,
        description: form.description,
        capacity: Number(form.capacity),
        images: form.images.map(({ url, alt }) => ({ url, alt: alt || "" })),
        facilities: form.facilitiesText
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        active: form.active,
        published: form.published,
        pricing: form.pricing.map((r) => ({
          key: r.key,
          label: r.label,
          amount: toPaise(r.amount),
          durationMinutes: Number(r.durationMinutes),
          weekendAmount: r.weekendAmount === "" ? null : toPaise(r.weekendAmount),
          overrides: r.overrides.map((o) => ({
            startDate: o.startDate,
            endDate: o.endDate,
            amount: toPaise(o.amount),
          })),
        })),
      };
      await saveHall(base, input);
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return { form, setForm, field, updateRate, save, busy, error };
}

import { Plus, X } from "lucide-react";
import { Button, Field } from "../../../components/ui";
const rateTypes = [
  ["FULL_DAY", "Full day", 1440],
  ["HALF_DAY", "Half day", 720],
  ["HOURLY", "Hourly", 720],
  ["PACKAGE", "Package", 1440],
  ["CUSTOM", "Custom time range", 1440],
];
export default function HallPricing({ form, setForm, updateRate }) {
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">HALL-WISE PRICING</p>
          <h2>Choose how your hall is booked.</h2>
        </div>
      </div>
      <p className="muted">
        Choose the booking options you offer and set your own prices in rupees. Saved rates remain
        editable. These prices are for customer bookings; your hall subscription is charged
        separately.
      </p>
      <p className="muted">
        Hourly bookings round up to the next hour. Date overrides use the event’s local start date.
      </p>
      <div className="rate-toggles">
        {rateTypes.map(([key, label, durationMinutes]) => {
          const enabled = form.pricing.some((r) => r.key === key);
          return (
            <Button
              key={key}
              type="button"
              variant={enabled ? "primary" : "secondary"}
              onClick={() =>
                setForm({
                  ...form,
                  pricing: enabled
                    ? form.pricing.filter((r) => r.key !== key)
                    : [
                        ...form.pricing,
                        {
                          key,
                          label,
                          durationMinutes,
                          amount: "",
                          weekendAmount: "",
                          overrides: [],
                        },
                      ],
                })
              }
            >
              {enabled ? "✓" : "+"} {label}
            </Button>
          );
        })}
      </div>
      {form.pricing.map((r, i) => (
        <div className="rate-editor" key={r.key}>
          <div className="section-title">
            <strong>{rateTypes.find((t) => t[0] === r.key)[1]}</strong>
            <span className="eyebrow">INR</span>
          </div>
          <div className="form-grid">
            <Field
              label="Rate / package name"
              value={r.label}
              required
              maxLength={80}
              onChange={(e) => updateRate(i, "label", e.target.value)}
            />
            <Field
              label={r.key === "HOURLY" ? "Price per hour (₹)" : "Price (₹)"}
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="Enter your price"
              hint="You set this booking price and can change it anytime."
              value={r.amount}
              onChange={(e) => updateRate(i, "amount", e.target.value)}
            />
            <Field
              label="Weekend price (₹, optional)"
              type="number"
              min="0"
              step="0.01"
              value={r.weekendAmount}
              onChange={(e) => updateRate(i, "weekendAmount", e.target.value)}
              hint="Saturday & Sunday. Blank uses the regular rate."
            />
            <Field
              label={
                r.key === "FULL_DAY"
                  ? "Full day: local midnight to midnight"
                  : r.key === "HALF_DAY"
                    ? "Booking duration (minutes)"
                    : "Maximum duration (minutes)"
              }
              type="number"
              min={15}
              max={10080}
              required
              disabled={r.key === "FULL_DAY"}
              value={r.durationMinutes}
              onChange={(e) => updateRate(i, "durationMinutes", e.target.value)}
            />
          </div>
          <div className="override-list">
            <div className="section-title">
              <h4>Seasonal & date overrides</h4>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  updateRate(i, "overrides", [
                    ...r.overrides,
                    { startDate: "", endDate: "", amount: "" },
                  ])
                }
              >
                <Plus size={14} />
                Add dates
              </Button>
            </div>
            {r.overrides.map((o, n) => (
              <div className="override-row" key={n}>
                <Field
                  label="From"
                  type="date"
                  required
                  value={o.startDate}
                  onChange={(e) =>
                    updateRate(
                      i,
                      "overrides",
                      r.overrides.map((v, k) =>
                        k === n ? { ...v, startDate: e.target.value } : v,
                      ),
                    )
                  }
                />
                <Field
                  label="Through"
                  type="date"
                  required
                  value={o.endDate}
                  onChange={(e) =>
                    updateRate(
                      i,
                      "overrides",
                      r.overrides.map((v, k) => (k === n ? { ...v, endDate: e.target.value } : v)),
                    )
                  }
                />
                <Field
                  label="Override rate (₹)"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={o.amount}
                  onChange={(e) =>
                    updateRate(
                      i,
                      "overrides",
                      r.overrides.map((v, k) => (k === n ? { ...v, amount: e.target.value } : v)),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="Remove date override"
                  onClick={() =>
                    updateRate(
                      i,
                      "overrides",
                      r.overrides.filter((_, k) => k !== n),
                    )
                  }
                >
                  <X size={16} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

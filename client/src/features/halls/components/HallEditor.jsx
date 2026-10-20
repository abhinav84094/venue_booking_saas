import { X, Save } from "lucide-react";
import { ErrorNotice, Button, Field, TextArea, ImageManager } from "../../../components/ui";
import HallPricing from "./HallPricing";
import { useHallEditor } from "../hooks/useHallEditor";
export default function HallEditor({ initial, base, onClose, onSaved }) {
  const { form, setForm, field, updateRate, save, busy, error } = useHallEditor(
    initial,
    base,
    onSaved,
  );
  return (
    <form className="form-stack" onSubmit={save}>
      <ErrorNotice error={error} />
      <section className="panel">
        <div className="section-title">
          <h2>{initial._id ? "Refine your space" : "A new space, a new possibility"}</h2>
          <Button variant="ghost" type="button" onClick={onClose}>
            <X size={16} />
            Close
          </Button>
        </div>
        <div className="form-grid">
          <Field label="Hall name" required minLength={2} maxLength={120} {...field("name")} />
          <Field
            label="Guest capacity"
            type="number"
            min={1}
            max={100000}
            required
            {...field("capacity")}
          />
        </div>
        <TextArea label="About this hall" maxLength={3000} {...field("description")} />
        <Field
          label="Facilities (separate with commas)"
          placeholder="Air conditioning, stage, private entrance"
          {...field("facilitiesText")}
        />
        <div className="checkbox-row">
          <label>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active for new bookings
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => setForm({ ...form, published: e.target.checked })}
            />
            Show on the public website
          </label>
        </div>
      </section>
      <HallPricing form={form} setForm={setForm} updateRate={updateRate} />
      <section className="panel">
        <ImageManager
          base={base}
          images={form.images}
          onChange={(images) => setForm({ ...form, images })}
        />
      </section>
      <div className="form-footer">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" busy={busy}>
          <Save size={16} />
          Save hall & pricing
        </Button>
      </div>
    </form>
  );
}
